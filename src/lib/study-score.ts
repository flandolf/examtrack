import {
  analyseAttempt,
  findAttemptReference,
  type AssessmentReference,
  type ExamAttempt,
} from "@/lib/exam-data"

export type StudyScoreEvidence = {
  attempt: ExamAttempt
  percentile: number
  weight: number
}

export type StudyScorePrediction = {
  studyScore: number
  low: number
  high: number
  combinedPercentile: number
  examPercentile: number
  observedExamPercentile: number
  sacPercentile: number
  examWeightPercent: number
  confidence: "Low" | "Medium" | "High"
  evidence: StudyScoreEvidence[]
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

// Peter J. Acklam's inverse-normal approximation. It is accurate well beyond
// the precision justified by a VCE study-score estimate.
export function inverseNormalCdf(probability: number): number {
  const p = clamp(probability, 0.0001, 0.9999)
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924]
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857]
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878]
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742]
  const lower = 0.02425
  const upper = 1 - lower

  if (p < lower) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > upper) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }

  const q = p - 0.5
  const r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

export function percentileToRawStudyScore(percentile: number): number {
  return clamp(30 + 7 * inverseNormalCdf(clamp(percentile, 0.1, 99.9) / 100), 0, 50)
}

export function defaultExamWeight(subject: string): number {
  return /mathematical methods|specialist mathematics/i.test(subject) ? 60 : 50
}

export function predictStudyScore({
  subject,
  attempts,
  references,
  sacPercentile,
  examWeightPercent = defaultExamWeight(subject),
}: {
  subject: string
  attempts: ExamAttempt[]
  references: AssessmentReference[]
  sacPercentile?: number | null
  examWeightPercent?: number
}): StudyScorePrediction | null {
  const linked = attempts
    .filter((attempt) => attempt.subject === subject)
    .flatMap((attempt) => {
      const reference = findAttemptReference(attempt, references)
      if (!reference) return []
      const percentile = analyseAttempt(attempt, reference).percentile
      return percentile === null ? [] : [{ attempt, percentile }]
    })
    .toSorted((first, second) => first.attempt.completedAt.localeCompare(second.attempt.completedAt))

  if (linked.length === 0) return null

  const evidence = linked.map((item, index) => ({
    ...item,
    weight: 0.82 ** (linked.length - index - 1),
  }))
  const weightTotal = evidence.reduce((total, item) => total + item.weight, 0)
  const observedExamPercentile = evidence.reduce(
    (total, item) => total + item.percentile * item.weight,
    0,
  ) / weightTotal

  // Small samples are pulled towards the statewide median to reduce dramatic
  // predictions from a single unusually easy or difficult practice paper.
  const reliability = weightTotal / (weightTotal + 1.5)
  const examPercentile = 50 + reliability * (observedExamPercentile - 50)
  const resolvedSacPercentile = sacPercentile == null
    ? examPercentile
    : clamp(sacPercentile, 0.1, 99.9)
  const examWeight = clamp(examWeightPercent, 0, 100) / 100
  const combinedPercentile = examPercentile * examWeight + resolvedSacPercentile * (1 - examWeight)

  const variance = evidence.reduce(
    (total, item) => total + item.weight * (item.percentile - observedExamPercentile) ** 2,
    0,
  ) / weightTotal
  const effectiveSampleSize = weightTotal ** 2 /
    evidence.reduce((total, item) => total + item.weight ** 2, 0)
  const percentileUncertainty = clamp(
    6 + Math.sqrt(variance) / Math.sqrt(effectiveSampleSize) + 10 * (1 - reliability),
    6,
    22,
  ) * examWeight
  const lowPercentile = clamp(combinedPercentile - percentileUncertainty, 0.1, 99.9)
  const highPercentile = clamp(combinedPercentile + percentileUncertainty, 0.1, 99.9)
  const confidence = linked.length >= 5 && Math.sqrt(variance) <= 15
    ? "High"
    : linked.length >= 2
      ? "Medium"
      : "Low"

  return {
    studyScore: Math.round(percentileToRawStudyScore(combinedPercentile)),
    low: Math.max(0, Math.floor(percentileToRawStudyScore(lowPercentile))),
    high: Math.min(50, Math.ceil(percentileToRawStudyScore(highPercentile))),
    combinedPercentile,
    examPercentile,
    observedExamPercentile,
    sacPercentile: resolvedSacPercentile,
    examWeightPercent: examWeight * 100,
    confidence,
    evidence,
  }
}
