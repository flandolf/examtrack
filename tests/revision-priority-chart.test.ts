import { expect, test } from "bun:test"
import { buildRevisionPriorities } from "../src/components/revision-priority-chart"
import type { Mistake } from "../src/lib/exam-data"

const mistake = (category: Mistake["category"], resolved = false): Mistake => ({
  id: crypto.randomUUID(),
  attemptId: "attempt-1",
  question: "1a",
  category,
  explanation: "Missed a step",
  correction: "Show the step",
  resolved,
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
})

test("ranks revision categories by unresolved mistakes", () => {
  expect(buildRevisionPriorities([
    mistake("Concept"),
    mistake("Algebra"),
    mistake("Concept", true),
    mistake("Algebra"),
  ])).toEqual([
    { category: "Algebra", unresolved: 2, resolved: 0 },
    { category: "Concept", unresolved: 1, resolved: 1 },
  ])
})
