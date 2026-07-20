import { describe, expect, test } from "bun:test"
import { buildExamSuggestions } from "../src/lib/exam-suggestions"
import type { AssessmentReference, ExamAttempt } from "../src/lib/exam-data"

function reference(year: number, paper: number, studyName = "Mathematical Methods"): AssessmentReference {
  return {
    id: `${studyName}:${year}:${paper}`,
    studyCode: "METHODS",
    studyName,
    displayName: studyName,
    year,
    gaCode: `GA ${paper + 1}`,
    name: `WRITTEN EXAMINATION ${paper}`,
    maxScore: paper === 1 ? 40 : 80,
    sourceUrl: "https://example.test",
    gradeBands: [],
  }
}

function attempt(overrides: Partial<ExamAttempt> = {}): ExamAttempt {
  return {
    id: "attempt-1",
    subject: "Mathematical Methods",
    provider: "VCAA",
    title: "VCAA 2011 Mathematical Methods",
    examYear: 2011,
    paper: "Exam 2",
    completedAt: "2026-07-19",
    rawScore: 60,
    rawMax: 80,
    referenceId: null,
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
    ...overrides,
  }
}

const references = [
  reference(2011, 1),
  reference(2011, 2),
  reference(2012, 1),
  reference(2012, 2),
  reference(2013, 1),
  reference(2013, 2),
]

describe("next exam suggestions", () => {
  test("continues the latest subject into the next exam years", () => {
    expect(buildExamSuggestions([attempt()], references, ["Mathematical Methods"])).toEqual([
      expect.objectContaining({ examYear: 2012, paper: "Exam 1" }),
      expect.objectContaining({ examYear: 2012, paper: "Exam 2" }),
      expect.objectContaining({ examYear: 2013, paper: "Exam 1" }),
      expect.objectContaining({ examYear: 2013, paper: "Exam 2" }),
    ])
  })

  test("skips papers that have already been logged", () => {
    const logged2012 = attempt({ id: "attempt-2", examYear: 2012, paper: "Exam 1", completedAt: "2026-07-18" })
    const suggestions = buildExamSuggestions([attempt(), logged2012], references, ["Mathematical Methods"])
    expect(suggestions.some((item) => item.examYear === 2012 && item.paper === "Exam 1")).toBe(false)
    expect(suggestions[0]).toEqual(expect.objectContaining({ examYear: 2012, paper: "Exam 2" }))
  })

  test("uses preferred subjects and recent papers when there is no attempt history", () => {
    const chemistry = [reference(2024, 1, "Chemistry"), reference(2025, 1, "Chemistry")]
    expect(buildExamSuggestions([], [...references, ...chemistry], ["Chemistry"], 2)).toEqual([
      expect.objectContaining({ subject: "Chemistry", examYear: 2025 }),
      expect.objectContaining({ subject: "Chemistry", examYear: 2024 }),
    ])
  })
})
