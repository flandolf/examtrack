import { normaliseComparisonName, type AssessmentReference, type ExamAttempt } from "@/lib/exam-data"

const VCAA_EXAM_RESOURCES = "https://www.vcaa.vic.edu.au/assessment/vce/examination-specifications-past-examinations-and-examination-reports/examination-specifications-past-examinations-and-external-assessment-reports"

export function getVcaaExamResourcesUrl() {
  return VCAA_EXAM_RESOURCES
}

export function formatReferenceFreshness(generatedAt?: string | null) {
  if (!generatedAt) return "Reference update date unavailable"
  return `Grade distributions updated ${new Date(generatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`
}

export type VcaaResourceKind = "specification" | "exam" | "report" | "sample" | "other"

export type VcaaResource = {
  label: string
  url: string
  kind: VcaaResourceKind
  year: number | null
}

export type VcaaStudyResources = {
  studyName: string
  pageUrl: string
  resources: VcaaResource[]
}

export type VcaaExamResource = VcaaResource & Pick<VcaaStudyResources, "studyName" | "pageUrl">

export function getVcaaExams(studies: VcaaStudyResources[]): VcaaExamResource[] {
  return studies.flatMap((study) => study.resources
    .filter((resource) => resource.kind === "exam")
    .map((resource) => ({ ...resource, studyName: study.studyName, pageUrl: study.pageUrl })))
}

export function getVcaaExamPaper(exam: Pick<VcaaExamResource, "label">) {
  const number = exam.label.match(/\b(?:exam(?:ination)?|paper)\s*([1-9])\b/i)?.[1] ??
    exam.label.match(/\b([1-9])\s+(?:exam(?:ination)?|paper)\b/i)?.[1]
  return number ? `Exam ${number}` : "Exam"
}

export function findVcaaExamReference(exam: VcaaExamResource, references: AssessmentReference[]) {
  if (exam.year === null) return undefined
  const paper = normaliseComparisonName(getVcaaExamPaper(exam))
  return references.find((reference) => reference.year === exam.year &&
    normaliseComparisonName(reference.studyName) === normaliseComparisonName(exam.studyName) &&
    normaliseComparisonName(reference.name) === paper)
}

export function isVcaaExamLogged(exam: VcaaExamResource, attempts: ExamAttempt[]) {
  if (exam.year === null) return false
  const paper = normaliseComparisonName(getVcaaExamPaper(exam))
  return attempts.some((attempt) => attempt.examYear === exam.year &&
    normaliseComparisonName(attempt.provider) === "vcaa" &&
    normaliseComparisonName(attempt.subject) === normaliseComparisonName(exam.studyName) &&
    (paper === "exam" || normaliseComparisonName(attempt.paper) === paper))
}
