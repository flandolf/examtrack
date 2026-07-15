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
