import { expect, test } from "bun:test"
import { findVcaaExamReference, getVcaaExamPaper, getVcaaExams, isVcaaExamLogged, type VcaaExamResource } from "../src/lib/vcaa-resources"
import type { AssessmentReference, ExamAttempt } from "../src/lib/exam-data"

const exam: VcaaExamResource = {
  studyName: "Mathematical Methods",
  pageUrl: "https://example.test/methods",
  label: "2006 Mathematical Methods exam 1",
  url: "https://example.test/2006-methods-1.pdf",
  kind: "exam",
  year: 2006,
}

test("includes archived exams without grade distributions", () => {
  expect(getVcaaExams([{ studyName: exam.studyName, pageUrl: exam.pageUrl, resources: [exam] }])).toEqual([exam])
  expect(getVcaaExamPaper(exam)).toBe("Exam 1")
  expect(findVcaaExamReference(exam, [])).toBeUndefined()
  expect(getVcaaExams([{ studyName: exam.studyName, pageUrl: exam.pageUrl, resources: [{ ...exam, year: null }] }])).toHaveLength(1)
})

test("matches optional distributions and logged VCAA attempts", () => {
  const reference = { year: 2006, studyName: exam.studyName, name: "WRITTEN EXAMINATION 1" } as AssessmentReference
  const attempt = { provider: "VCAA", examYear: 2006, subject: exam.studyName, paper: "Exam 1" } as ExamAttempt
  expect(findVcaaExamReference(exam, [reference])).toBe(reference)
  expect(isVcaaExamLogged(exam, [attempt])).toBe(true)
  expect(isVcaaExamLogged(exam, [{ ...attempt, paper: "Exam 2" }])).toBe(false)
})
