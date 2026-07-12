import { expect, test } from "bun:test"
import { getExamIdFromHash, getExamTarget } from "../src/lib/exam-target"

test("round-trips an exam id through its dashboard target", () => {
  const id = "attempt/with spaces"
  const target = getExamTarget(id)
  expect(target).toBe("exam-attempt%2Fwith%20spaces")
  expect(getExamIdFromHash(`#${target}`)).toBe(id)
  expect(getExamIdFromHash("#mistakes")).toBeNull()
})
