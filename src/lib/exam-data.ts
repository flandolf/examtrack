export const MISTAKE_CATEGORIES = [
  "Concept",
  "Algebra",
  "Arithmetic",
  "Calculator",
  "Interpretation",
  "Time management",
  "Other",
] as const

export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number]

export type GradeBand = {
  grade: string
  minScore: number | null
  maxScore: number | null
  count: number | null
  percentage: number | null
  sortOrder: number
}

export type AssessmentReference = {
  id: string
  studyCode: string
  studyName: string
  displayName: string
  year: number
  gaCode: string
  name: string
  maxScore: number
  sourceUrl: string
  gradeBands: GradeBand[]
}

export type ExamAttempt = {
  id: string
  subject: string
  provider: string
  title: string
  examYear: number
  paper: string
  completedAt: string
  rawScore: number
  rawMax: number
  comment?: string
  referenceId: string | null
  createdAt: string
  updatedAt: string
}

export type Mistake = {
  id: string
  attemptId: string
  question: string
  questionText?: string
  category: MistakeCategory
  explanation: string
  correction: string
  totalMarks?: number
  marksLost?: number
  resolved: boolean
  createdAt: string
  updatedAt: string
}

export type AppData = {
  schemaVersion: 2
  attempts: ExamAttempt[]
  mistakes: Mistake[]
  trackedExamIds: string[]
}

export const EMPTY_APP_DATA: AppData = {
  schemaVersion: 2,
  attempts: [],
  mistakes: [],
  trackedExamIds: [],
}

export function formatExamTitle(provider: string, examYear: number, subject: string): string {
  return `${provider.trim() || "Other"} ${examYear} ${subject.trim()}`
}

export type AttemptAnalysis = {
  scaledScore: number
  percentage: number
  grade: string | null
  percentile: number | null
}

export type AttemptPoint = {
  grade: string
  percentile: number
  scaledScore: number
  attempt: ExamAttempt
}

export function analyseScore(
  scaledScore: number,
  reference: AssessmentReference,
): Pick<AttemptAnalysis, "grade" | "percentile"> {
  const score = Math.round(scaledScore)
  const band = reference.gradeBands.find(
    ({ minScore, maxScore }) =>
      minScore !== null && maxScore !== null && score >= minScore && score <= maxScore,
  )

  if (!band) return { grade: null, percentile: null }

  const ordered = reference.gradeBands.toSorted(
    (first, second) => (first.minScore ?? 0) - (second.minScore ?? 0),
  )
  const lowerPercentage = ordered
    .slice(0, ordered.indexOf(band))
    .reduce((total, item) => total + (item.percentage ?? 0), 0)
  const bandPercentage = band.percentage ?? null
  const range = (band.maxScore ?? 0) - (band.minScore ?? 0)
  const position = range > 0
    ? Math.min(1, Math.max(0, (scaledScore - (band.minScore ?? 0)) / range))
    : 0.5
  const percentile = bandPercentage === null
    ? null
    : Math.min(100, Math.max(0, lowerPercentage + position * bandPercentage))

  return { grade: band.grade, percentile }
}

export function analyseAttempt(
  attempt: Pick<ExamAttempt, "rawScore" | "rawMax">,
  reference?: AssessmentReference,
): AttemptAnalysis {
  const percentage = (attempt.rawScore / attempt.rawMax) * 100
  const scaledScore = reference
    ? (attempt.rawScore / attempt.rawMax) * reference.maxScore
    : attempt.rawScore
  if (!reference) {
    return { scaledScore, percentage, grade: null, percentile: null }
  }

  return { scaledScore, percentage, ...analyseScore(scaledScore, reference) }
}

export function validateAttempt(
  attempt: Pick<ExamAttempt, "rawScore" | "rawMax">,
): string | null {
  if (!Number.isFinite(attempt.rawMax) || attempt.rawMax <= 0) {
    return "Maximum mark must be greater than zero."
  }
  if (!Number.isFinite(attempt.rawScore) || attempt.rawScore < 0) {
    return "Mark must be zero or greater."
  }
  if (attempt.rawScore > attempt.rawMax) {
    return "Mark cannot exceed the maximum."
  }
  return null
}

export function validateMistakeMarks(totalMarks: number, marksLost: number): string | null {
  if (!Number.isFinite(totalMarks) || totalMarks <= 0) return "Total marks must be greater than zero."
  if (!Number.isFinite(marksLost) || marksLost < 0) return "Marks lost must be zero or greater."
  return marksLost > totalMarks ? "Marks lost cannot exceed total marks." : null
}

export function normaliseComparisonName(value: string) {
  return value
    .toLowerCase()
    .replace(/\bwritten\b/g, "")
    .replace(/\b(examination|paper)\b/g, "exam")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function matchesAttemptReference(attempt: Pick<ExamAttempt, "subject" | "paper">, reference: AssessmentReference) {
  return normaliseComparisonName(attempt.subject) === normaliseComparisonName(reference.studyName) &&
    normaliseComparisonName(attempt.paper) === normaliseComparisonName(reference.name)
}

export function getAttemptPoints(
  attempts: ExamAttempt[],
  reference: AssessmentReference,
): AttemptPoint[] {
  return attempts.flatMap((attempt) => {
    if (!matchesAttemptReference(attempt, reference)) return []
    const analysis = analyseAttempt(attempt, reference)
    return analysis.grade && analysis.percentile !== null
      ? [{ grade: analysis.grade, percentile: analysis.percentile, scaledScore: analysis.scaledScore, attempt }]
      : []
  })
}

export type DistributionStats = {
  mean: number
  median: number
  variance: number
  stdDev: number
  meanPercentage: number
}

export type VcaaYearInsight = {
  year: number
  cohortSize: number | null
  maxScore: number
  meanPercentage: number
  medianPercentage: number
  aPlusCutoffPercentage: number | null
  grade: string | null
  percentile: number | null
  sourceUrl: string
}

export function computeDistributionStats(reference: AssessmentReference): DistributionStats {
  const bands = reference.gradeBands.toSorted(
    (first, second) => (first.minScore ?? 0) - (second.minScore ?? 0),
  )
  let mean = 0
  for (const band of bands) {
    const min = band.minScore ?? band.maxScore ?? 0
    const max = band.maxScore ?? band.minScore ?? 0
    const midpoint = (min + max) / 2
    mean += midpoint * ((band.percentage ?? 0) / 100)
  }

  let variance = 0
  for (const band of bands) {
    const min = band.minScore ?? band.maxScore ?? 0
    const max = band.maxScore ?? band.minScore ?? 0
    const midpoint = (min + max) / 2
    const weight = (band.percentage ?? 0) / 100
    variance += weight * (midpoint - mean) ** 2
  }

  const stdDev = Math.sqrt(variance)
  const meanPercentage = reference.maxScore > 0 ? (mean / reference.maxScore) * 100 : 0
  const medianTarget = bands.reduce((total, band) => total + (band.percentage ?? 0), 0) / 2
  let cumulativePercentage = 0
  let median = mean
  for (const band of bands) {
    const percentage = band.percentage ?? 0
    if (percentage > 0 && cumulativePercentage + percentage >= medianTarget) {
      const min = band.minScore ?? band.maxScore ?? 0
      const max = band.maxScore ?? band.minScore ?? 0
      median = min + ((medianTarget - cumulativePercentage) / percentage) * (max - min)
      break
    }
    cumulativePercentage += percentage
  }

  return { mean, median, variance, stdDev, meanPercentage }
}

export function buildVcaaYearInsights(
  references: AssessmentReference[],
  scorePercentage: number,
): VcaaYearInsight[] {
  return references.map((reference) => {
    const stats = computeDistributionStats(reference)
    const cohortCounts = reference.gradeBands.map((band) => band.count)
    const cohortSize = cohortCounts.some((count) => count !== null)
      ? cohortCounts.reduce<number>((total, count) => total + (count ?? 0), 0)
      : null
    const aPlus = reference.gradeBands.find((band) => band.grade.trim().toUpperCase() === "A+")
    const analysis = analyseScore((scorePercentage / 100) * reference.maxScore, reference)

    return {
      year: reference.year,
      cohortSize,
      maxScore: reference.maxScore,
      meanPercentage: stats.meanPercentage,
      medianPercentage: reference.maxScore > 0 ? (stats.median / reference.maxScore) * 100 : 0,
      aPlusCutoffPercentage: aPlus?.minScore === null || aPlus?.minScore === undefined
        ? null
        : (aPlus.minScore / reference.maxScore) * 100,
      grade: analysis.grade,
      percentile: analysis.percentile,
      sourceUrl: reference.sourceUrl,
    }
  }).toSorted((first, second) => first.year - second.year)
}

export function getReferencesForAttempt(
  attempt: ExamAttempt,
  references: AssessmentReference[],
): AssessmentReference[] {
  return [...new Set(references.map((reference) => reference.year))]
    .flatMap((year) => findAttemptReferenceForYear(attempt, references, year) ?? [])
    .toSorted((a, b) => b.year - a.year)
}

export function findAttemptReferenceForYear(
  attempt: Pick<ExamAttempt, "subject" | "paper">,
  references: AssessmentReference[],
  year: number,
): AssessmentReference | undefined {
  const subject = normaliseComparisonName(attempt.subject)
  const candidates = references.filter(
    (reference) => reference.year === year && normaliseComparisonName(reference.studyName) === subject,
  )
  return candidates.find((reference) => matchesAttemptReference(attempt, reference)) ??
    (candidates.length === 1 ? candidates[0] : undefined)
}

export function findAttemptReference(
  attempt: ExamAttempt,
  references: AssessmentReference[],
): AssessmentReference | undefined {
  return findAttemptReferenceForYear(attempt, references, attempt.examYear) ?? (attempt.referenceId
    ? references.find((reference) => reference.id === attempt.referenceId)
    : undefined)
}

export type AttemptBenchmark = {
  attempt: ExamAttempt
  reference: AssessmentReference
  percentage: number
  grade: string | null
  percentile: number | null
  vcaaMeanPercentage: number
  aPlusCutoffPercentage: number | null
  gapToAPlus: number | null
}

export function buildAttemptBenchmarks(
  attempts: ExamAttempt[],
  references: AssessmentReference[],
): AttemptBenchmark[] {
  return attempts.flatMap((attempt) => {
    const reference = findAttemptReference(attempt, references)
    if (!reference) return []
    const analysis = analyseAttempt(attempt, reference)
    const aPlus = reference.gradeBands.find((band) => band.grade.trim().toUpperCase() === "A+")
    const aPlusCutoffPercentage = aPlus?.minScore == null
      ? null
      : (aPlus.minScore / reference.maxScore) * 100

    return [{
      attempt,
      reference,
      percentage: analysis.percentage,
      grade: analysis.grade,
      percentile: analysis.percentile,
      vcaaMeanPercentage: computeDistributionStats(reference).meanPercentage,
      aPlusCutoffPercentage,
      gapToAPlus: aPlusCutoffPercentage === null ? null : analysis.percentage - aPlusCutoffPercentage,
    }]
  }).toSorted((first, second) => first.attempt.completedAt.localeCompare(second.attempt.completedAt))
}

export type SubjectBenchmark = {
  subject: string
  attemptCount: number
  linkedCount: number
  averageMark: number
  bestMark: number
  latestMark: number
  averagePercentile: number | null
  vcaaMeanPercentage: number | null
  aPlusCutoffPercentage: number | null
}

export function buildSubjectBenchmarks(
  attempts: ExamAttempt[],
  references: AssessmentReference[],
): SubjectBenchmark[] {
  const benchmarks = buildAttemptBenchmarks(attempts, references)
  const benchmarksByAttempt = new Map(benchmarks.map((item) => [item.attempt.id, item]))
  const buckets = new Map<string, {
    marks: number[]
    linked: AttemptBenchmark[]
    latestDate: string
    latestMark: number
  }>()

  for (const attempt of attempts) {
    const mark = (attempt.rawScore / attempt.rawMax) * 100
    const bucket = buckets.get(attempt.subject) ?? { marks: [], linked: [], latestDate: "", latestMark: mark }
    bucket.marks.push(mark)
    const benchmark = benchmarksByAttempt.get(attempt.id)
    if (benchmark) bucket.linked.push(benchmark)
    if (attempt.completedAt >= bucket.latestDate) {
      bucket.latestDate = attempt.completedAt
      bucket.latestMark = mark
    }
    buckets.set(attempt.subject, bucket)
  }

  const average = (values: number[]) => values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null

  return [...buckets.entries()].map(([subject, bucket]) => {
    const percentiles = bucket.linked.flatMap((item) => item.percentile === null ? [] : [item.percentile])
    const cutoffs = bucket.linked.flatMap((item) => item.aPlusCutoffPercentage === null ? [] : [item.aPlusCutoffPercentage])
    return {
      subject,
      attemptCount: bucket.marks.length,
      linkedCount: bucket.linked.length,
      averageMark: average(bucket.marks) ?? 0,
      bestMark: Math.max(...bucket.marks),
      latestMark: bucket.latestMark,
      averagePercentile: average(percentiles),
      vcaaMeanPercentage: average(bucket.linked.map((item) => item.vcaaMeanPercentage)),
      aPlusCutoffPercentage: average(cutoffs),
    }
  }).toSorted((first, second) => second.averageMark - first.averageMark)
}

export function formatReferenceName(name: string): string {
  return name.toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\b(And|Or)\b/g, (word) => word.toLowerCase())
    .replace(/^Written Examination/, "Exam")
    .trim()
}

export function removeAttempt(data: AppData, attemptId: string): AppData {
  return {
    ...data,
    attempts: data.attempts.filter((attempt) => attempt.id !== attemptId),
    mistakes: data.mistakes.filter((mistake) => mistake.attemptId !== attemptId),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

export function isAppData(value: unknown): value is AppData {
  if (!isRecord(value)) return false
  const data = value as Partial<AppData>
  const attemptsValid =
    Array.isArray(data.attempts) &&
    data.attempts.every(
      (value) => {
        if (!isRecord(value)) return false
        const attempt = value as unknown as ExamAttempt
        return (
          typeof attempt.id === "string" &&
          typeof attempt.subject === "string" &&
          typeof attempt.provider === "string" &&
          typeof attempt.title === "string" &&
          typeof attempt.examYear === "number" &&
          typeof attempt.paper === "string" &&
          typeof attempt.completedAt === "string" &&
          typeof attempt.rawScore === "number" &&
          typeof attempt.rawMax === "number" &&
          (attempt.comment === undefined || typeof attempt.comment === "string") &&
          (attempt.referenceId === null || typeof attempt.referenceId === "string") &&
          typeof attempt.createdAt === "string" &&
          typeof attempt.updatedAt === "string" &&
          validateAttempt(attempt) === null
        )
      },
    )
  const attemptIds = new Set(data.attempts?.map((attempt) => attempt.id))
  const mistakesValid =
    Array.isArray(data.mistakes) &&
    data.mistakes.every((value) => {
      if (!isRecord(value)) return false
      const mistake = value as unknown as Mistake
      return (
        typeof mistake.id === "string" &&
        typeof mistake.attemptId === "string" &&
        attemptIds.has(mistake.attemptId) &&
        typeof mistake.question === "string" &&
        (mistake.questionText === undefined || typeof mistake.questionText === "string") &&
        MISTAKE_CATEGORIES.includes(mistake.category) &&
        typeof mistake.explanation === "string" &&
        typeof mistake.correction === "string" &&
        (mistake.totalMarks === undefined || typeof mistake.totalMarks === "number") &&
        (mistake.marksLost === undefined || typeof mistake.marksLost === "number") &&
        (mistake.totalMarks === undefined && mistake.marksLost === undefined || validateMistakeMarks(mistake.totalMarks!, mistake.marksLost!) === null) &&
        typeof mistake.resolved === "boolean" &&
        typeof mistake.createdAt === "string" &&
        typeof mistake.updatedAt === "string"
      )
    })
  const trackedExamIdsValid =
    Array.isArray(data.trackedExamIds) &&
    data.trackedExamIds.every((value) => typeof value === "string")
  return (
    data.schemaVersion === 2 &&
    attemptsValid &&
    mistakesValid &&
    trackedExamIdsValid
  )
}

export function migrateAppData(value: unknown): AppData | null {
  if (!isRecord(value)) return null
  const data = value as Record<string, unknown>
  const schemaVersion = data.schemaVersion
  if (schemaVersion === 1) {
    const migrated = {
      schemaVersion: 2 as const,
      attempts: Array.isArray(data.attempts) ? data.attempts : [],
      mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
      trackedExamIds: [],
    }
    return isAppData(migrated) ? migrated : null
  }
  if (schemaVersion === 2) {
    if (!Array.isArray(data.trackedExamIds)) {
      const migrated = { ...(data as Partial<AppData>), trackedExamIds: [] }
      return isAppData(migrated) ? migrated : null
    }
    return isAppData(data) ? data : null
  }
  return null
}
