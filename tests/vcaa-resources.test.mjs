import { expect, test } from "bun:test"
import { parseStudyIndex, parseStudyResources } from "../vcaa/import-exam-resources.mjs"

test("parses VCAA study pages and classifies official resources", () => {
  expect(parseStudyIndex('<a href="/assessment/vce/examination-specifications-past-examinations-and-examination-reports/english">English</a>'))
    .toEqual([{ studyName: "English", pageUrl: "https://www.vcaa.vic.edu.au/assessment/vce/examination-specifications-past-examinations-and-examination-reports/english" }])
  expect(parseStudyResources('<a href="/files/2025-English.pdf">2025 VCE English examination</a><a href="/files/2025-report.docx">2025 English external assessment report</a>'))
    .toEqual([
      { label: "2025 VCE English examination", url: "https://www.vcaa.vic.edu.au/files/2025-English.pdf", kind: "exam", year: 2025 },
      { label: "2025 English external assessment report", url: "https://www.vcaa.vic.edu.au/files/2025-report.docx", kind: "report", year: 2025 },
    ])
})
