import { describe, expect, test } from "bun:test"
import type { ExamAttempt, Mistake } from "../src/lib/exam-data"
import { buildFocusPriorities, buildReviewForecast, buildSubjectOutlooks } from "../src/lib/performance-insights"

function makeAttempt(id: string, score: number, completedAt: string): ExamAttempt {
  return {
    id,
    subject: "Mathematical Methods",
    provider: "VCAA",
    title: `Practice ${id}`,
    examYear: 2025,
    paper: "Exam 1",
    completedAt,
    rawScore: score,
    rawMax: 100,
    referenceId: null,
    createdAt: `${completedAt}T00:00:00.000Z`,
    updatedAt: `${completedAt}T00:00:00.000Z`,
  }
}

function makeMistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    id: "mistake-1",
    attemptId: "attempt-3",
    question: "4b",
    category: "Concept",
    explanation: "Missed the chain rule",
    correction: "Apply the chain rule before simplifying",
    resolved: false,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  }
}

describe("performance insights", () => {
  test("projects an improving subject with a bounded uncertainty range", () => {
    const outlook = buildSubjectOutlooks([
      makeAttempt("attempt-1", 50, "2026-07-01"),
      makeAttempt("attempt-2", 60, "2026-07-08"),
      makeAttempt("attempt-3", 70, "2026-07-15"),
    ])[0]

    expect(outlook.currentAverage).toBe(60)
    expect(outlook.projectedNext).toBeGreaterThan(70)
    expect(outlook.predictionLow).toBeLessThan(outlook.projectedNext)
    expect(outlook.predictionHigh).toBeGreaterThan(outlook.projectedNext)
    expect(outlook.confidence).toBe("medium")
  })

  test("ranks weak, low-confidence areas above stronger areas", () => {
    const markedAttempt = {
      ...makeAttempt("attempt-3", 70, "2026-07-15"),
      questionResults: [
        { id: "q1", label: "1", marksAwarded: 1, maxMarks: 5, areaOfStudy: "Algebra", confidence: "low" as const },
        { id: "q2", label: "2", marksAwarded: 4, maxMarks: 5, areaOfStudy: "Calculus", confidence: "high" as const },
      ],
    }
    const priorities = buildFocusPriorities([markedAttempt], [
      makeMistake({ areaOfStudy: "Algebra", lapses: 2 }),
    ])

    expect(priorities.map((item) => item.areaOfStudy)).toEqual(["Algebra", "Calculus"])
    expect(priorities[0]).toMatchObject({ missedMarks: 4, unresolvedMistakes: 1, lapses: 2 })
    expect(priorities[0].priorityScore).toBeGreaterThan(priorities[1].priorityScore)
  })

  test("puts overdue reviews into today and schedules upcoming cards by day", () => {
    const forecast = buildReviewForecast([
      makeMistake({ id: "overdue", dueAt: "2026-07-19T12:00:00+10:00" }),
      makeMistake({ id: "tomorrow", dueAt: "2026-07-22T12:00:00+10:00" }),
      makeMistake({ id: "suspended", dueAt: "2026-07-22T12:00:00+10:00", suspended: true }),
    ], new Date("2026-07-21T12:00:00+10:00"), 3)

    expect(forecast.map((day) => day.due)).toEqual([1, 1, 0])
    expect(forecast[0].label).toBe("Today")
  })
})
