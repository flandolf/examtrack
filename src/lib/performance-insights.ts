import { getMistakeSchedule, type ExamAttempt, type Mistake } from "@/lib/exam-data"

const DAY_MS = 24 * 60 * 60 * 1000

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value))
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0
  const mean = average(values)
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)))
}

export type SubjectOutlook = {
  subject: string
  attempts: number
  currentAverage: number
  projectedNext: number
  predictionLow: number
  predictionHigh: number
  momentum: number
  spread: number
  confidence: "low" | "medium" | "high"
}

function buildOutlook(subject: string, attempts: ExamAttempt[]): SubjectOutlook {
  const scores = attempts
    .toSorted((first, second) => first.completedAt.localeCompare(second.completedAt))
    .map((attempt) => attempt.rawScore / attempt.rawMax * 100)
  const recent = scores.slice(-3)
  const previous = scores.slice(-6, -3)
  const currentAverage = average(recent)
  const momentum = previous.length ? currentAverage - average(previous) : scores.length >= 2 ? scores.at(-1)! - scores.at(-2)! : 0
  const spread = standardDeviation(scores.slice(-5))

  if (scores.length < 2) {
    return {
      subject,
      attempts: scores.length,
      currentAverage,
      projectedNext: currentAverage,
      predictionLow: clamp(currentAverage - 10),
      predictionHigh: clamp(currentAverage + 10),
      momentum,
      spread,
      confidence: "low",
    }
  }

  // A recency-weighted least-squares trend reduces the influence of old papers while
  // retaining more evidence than a simple latest-vs-previous comparison.
  const weights = scores.map((_, index) => 0.78 ** (scores.length - index - 1))
  const weightTotal = weights.reduce((total, value) => total + value, 0)
  const meanX = scores.reduce((total, _, index) => total + index * weights[index], 0) / weightTotal
  const meanY = scores.reduce((total, score, index) => total + score * weights[index], 0) / weightTotal
  const denominator = scores.reduce((total, _, index) => total + weights[index] * (index - meanX) ** 2, 0)
  const slope = denominator
    ? scores.reduce((total, score, index) => total + weights[index] * (index - meanX) * (score - meanY), 0) / denominator
    : 0
  const intercept = meanY - slope * meanX
  const predicted = intercept + slope * scores.length
  const residualError = Math.sqrt(scores.reduce((total, score, index) => {
    const residual = score - (intercept + slope * index)
    return total + weights[index] * residual ** 2
  }, 0) / weightTotal)
  const uncertainty = Math.max(3, residualError * 1.65, scores.length < 4 ? 7 : 0)

  return {
    subject,
    attempts: scores.length,
    currentAverage,
    projectedNext: clamp(predicted),
    predictionLow: clamp(predicted - uncertainty),
    predictionHigh: clamp(predicted + uncertainty),
    momentum,
    spread,
    confidence: scores.length >= 6 ? "high" : scores.length >= 3 ? "medium" : "low",
  }
}

export function buildSubjectOutlooks(attempts: ExamAttempt[]): SubjectOutlook[] {
  const grouped = new Map<string, ExamAttempt[]>()
  for (const attempt of attempts) {
    grouped.set(attempt.subject, [...(grouped.get(attempt.subject) ?? []), attempt])
  }
  return [...grouped.entries()]
    .map(([subject, subjectAttempts]) => buildOutlook(subject, subjectAttempts))
    .toSorted((first, second) => first.projectedNext - second.projectedNext || second.attempts - first.attempts)
}

export type FocusPriority = {
  subject: string
  areaOfStudy: string
  priorityScore: number
  mastery: number | null
  missedMarks: number
  availableMarks: number
  questionCount: number
  confidenceRisk: number
  unresolvedMistakes: number
  lapses: number
}

type FocusBucket = Omit<FocusPriority, "priorityScore" | "mastery" | "confidenceRisk"> & {
  earnedMarks: number
  lowConfidence: number
  mediumConfidence: number
}

export function buildFocusPriorities(attempts: ExamAttempt[], mistakes: Mistake[]): FocusPriority[] {
  const buckets = new Map<string, FocusBucket>()
  const attemptSubjects = new Map(attempts.map((attempt) => [attempt.id, attempt.subject]))

  for (const attempt of attempts) {
    for (const result of attempt.questionResults ?? []) {
      const areaOfStudy = result.areaOfStudy?.trim()
      if (!areaOfStudy) continue
      const key = `${attempt.subject}\u0000${areaOfStudy}`
      const bucket = buckets.get(key) ?? {
        subject: attempt.subject,
        areaOfStudy,
        earnedMarks: 0,
        missedMarks: 0,
        availableMarks: 0,
        questionCount: 0,
        lowConfidence: 0,
        mediumConfidence: 0,
        unresolvedMistakes: 0,
        lapses: 0,
      }
      bucket.earnedMarks += result.marksAwarded
      bucket.missedMarks += Math.max(0, result.maxMarks - result.marksAwarded)
      bucket.availableMarks += result.maxMarks
      bucket.questionCount += 1
      if (result.confidence === "low") bucket.lowConfidence += 1
      if (result.confidence === "medium") bucket.mediumConfidence += 1
      buckets.set(key, bucket)
    }
  }

  for (const mistake of mistakes) {
    const areaOfStudy = mistake.areaOfStudy?.trim()
    const subject = attemptSubjects.get(mistake.attemptId)
    if (!areaOfStudy || !subject || mistake.suspended) continue
    const key = `${subject}\u0000${areaOfStudy}`
    const bucket = buckets.get(key) ?? {
      subject,
      areaOfStudy,
      earnedMarks: 0,
      missedMarks: 0,
      availableMarks: 0,
      questionCount: 0,
      lowConfidence: 0,
      mediumConfidence: 0,
      unresolvedMistakes: 0,
      lapses: 0,
    }
    const schedule = getMistakeSchedule(mistake)
    if (!schedule.resolved) bucket.unresolvedMistakes += 1
    bucket.lapses += schedule.lapses
    buckets.set(key, bucket)
  }

  return [...buckets.values()].map((bucket) => {
    const mastery = bucket.availableMarks ? bucket.earnedMarks / bucket.availableMarks * 100 : null
    const confidenceRisk = bucket.questionCount
      ? (bucket.lowConfidence + bucket.mediumConfidence * 0.5) / bucket.questionCount * 100
      : 0
    const markRisk = mastery === null ? (bucket.unresolvedMistakes ? 50 : 0) : 100 - mastery
    const reviewRisk = Math.min(100, bucket.unresolvedMistakes * 25 + bucket.lapses * 10)
    const priorityScore = clamp(markRisk * 0.6 + confidenceRisk * 0.25 + reviewRisk * 0.15)
    return {
      subject: bucket.subject,
      areaOfStudy: bucket.areaOfStudy,
      priorityScore,
      mastery,
      missedMarks: bucket.missedMarks,
      availableMarks: bucket.availableMarks,
      questionCount: bucket.questionCount,
      confidenceRisk,
      unresolvedMistakes: bucket.unresolvedMistakes,
      lapses: bucket.lapses,
    }
  }).filter((priority) => priority.questionCount > 0 || priority.unresolvedMistakes > 0)
    .toSorted((first, second) => second.priorityScore - first.priorityScore || second.missedMarks - first.missedMarks)
}

export type ReviewForecastDay = {
  date: string
  label: string
  due: number
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function buildReviewForecast(mistakes: Mistake[], now = new Date(), days = 14): ReviewForecastDay[] {
  const start = startOfLocalDay(now)
  const result = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS)
    return {
      date: formatLocalDate(date),
      label: index === 0 ? "Today" : date.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      due: 0,
    }
  })
  if (!result.length) return result

  for (const mistake of mistakes) {
    if (mistake.suspended) continue
    const dueAt = new Date(getMistakeSchedule(mistake).dueAt)
    const dueDay = startOfLocalDay(dueAt)
    const index = Math.floor((dueDay.getTime() - start.getTime()) / DAY_MS)
    if (index < 0) result[0].due += 1
    else if (index < result.length) result[index].due += 1
  }
  return result
}
