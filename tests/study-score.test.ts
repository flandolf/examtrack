import { describe, expect, test } from "bun:test"
import type { AssessmentReference, ExamAttempt } from "../src/lib/exam-data"
import { inverseNormalCdf, percentileToRawStudyScore, predictStudyScore } from "../src/lib/study-score"

const reference: AssessmentReference = {
  id: "METHODS:2025:GA-2",
  studyCode: "METHODS",
  studyName: "Mathematical Methods",
  displayName: "Mathematical Methods",
  year: 2025,
  gaCode: "GA 2",
  name: "WRITTEN EXAMINATION 1",
  maxScore: 40,
  sourceUrl: "https://example.test",
  gradeBands: [
    { grade: "C", minScore: 0, maxScore: 19, count: 50, percentage: 50, sortOrder: 0 },
    { grade: "B", minScore: 20, maxScore: 29, count: 25, percentage: 25, sortOrder: 1 },
    { grade: "A", minScore: 30, maxScore: 40, count: 25, percentage: 25, sortOrder: 2 },
  ],
}

function attempt(id: string, rawScore: number, completedAt: string): ExamAttempt {
  return {
    id,
    subject: "Mathematical Methods",
    provider: "VCAA",
    title: "VCAA 2025 Mathematical Methods",
    examYear: 2025,
    paper: "Exam 1",
    completedAt,
    rawScore,
    rawMax: 40,
    referenceId: reference.id,
    createdAt: `${completedAt}T00:00:00.000Z`,
    updatedAt: `${completedAt}T00:00:00.000Z`,
  }
}

describe("study score prediction", () => {
  test("maps the statewide median and common percentiles to raw study scores", () => {
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 8)
    expect(percentileToRawStudyScore(50)).toBeCloseTo(30, 8)
    expect(percentileToRawStudyScore(84.13)).toBeCloseTo(37, 1)
    expect(percentileToRawStudyScore(97.72)).toBeCloseTo(44, 1)
  })

  test("combines linked exam evidence with a supplied SAC percentile", () => {
    const prediction = predictStudyScore({
      subject: "Mathematical Methods",
      attempts: [attempt("one", 32, "2026-06-01"), attempt("two", 36, "2026-07-01")],
      references: [reference],
      sacPercentile: 80,
      examWeightPercent: 60,
    })

    expect(prediction).not.toBeNull()
    expect(prediction?.evidence).toHaveLength(2)
    expect(prediction?.confidence).toBe("Medium")
    expect(prediction?.combinedPercentile).toBeGreaterThan(70)
    expect(prediction?.studyScore).toBeGreaterThanOrEqual(34)
    expect(prediction?.low).toBeLessThan(prediction?.studyScore ?? 0)
    expect(prediction?.high).toBeGreaterThan(prediction?.studyScore ?? 50)
  })

  test("returns no prediction without an official linked result", () => {
    expect(predictStudyScore({
      subject: "Physical Education",
      attempts: [attempt("one", 32, "2026-06-01")],
      references: [reference],
    })).toBeNull()
  })
})
