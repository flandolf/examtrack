import { expect, test } from "bun:test"
import { buildMistakesTex } from "../src/lib/mistake-pdf"
import type { ExamAttempt, Mistake } from "../src/lib/exam-data"

test("builds a printable TeX worksheet while preserving maths", () => {
  const attempt = { id: "a", subject: "Maths & Methods", provider: "VCAA", examYear: 2025, paper: "Exam 1" } as ExamAttempt
  const mistake = { id: "m", attemptId: "a", question: "Q4_b", questionText: "Solve $x^2 + 1 = 0$.\n\nShow 50% of your work.", totalMarks: 3 } as Mistake
  const tex = buildMistakesTex([mistake], [attempt])

  expect(tex).toContain("Maths \\& Methods")
  expect(tex).toContain("Q4\\_b")
  expect(tex).toContain("$x^2 + 1 = 0$")
  expect(tex).toContain("50\\%")
  expect(tex).toContain("\\worklines{10}")
})
