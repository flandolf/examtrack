import {
  formatReferenceName,
  normaliseComparisonName,
  type AssessmentReference,
  type ExamAttempt,
} from "@/lib/exam-data"

export type ExamSuggestion = {
  subject: string
  provider: "VCAA"
  examYear: number
  paper: string
  marks: number
}

function paperOrder(paper: string) {
  return Number(paper.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER)
}

function suggestionKey(suggestion: Pick<ExamSuggestion, "subject" | "examYear" | "paper">) {
  return `${normaliseComparisonName(suggestion.subject)}\u0000${suggestion.examYear}\u0000${normaliseComparisonName(suggestion.paper)}`
}

function isLogged(suggestion: ExamSuggestion, attempts: ExamAttempt[]) {
  const subject = normaliseComparisonName(suggestion.subject)
  const paper = normaliseComparisonName(suggestion.paper)
  return attempts.some((attempt) =>
    attempt.examYear === suggestion.examYear &&
    normaliseComparisonName(attempt.provider) === "vcaa" &&
    normaliseComparisonName(attempt.subject) === subject &&
    normaliseComparisonName(attempt.paper) === paper,
  )
}

export function findLatestAttempt(attempts: ExamAttempt[]) {
  return [...attempts].toSorted((first, second) =>
    second.completedAt.localeCompare(first.completedAt) ||
    second.createdAt.localeCompare(first.createdAt),
  )[0] ?? null
}

export function buildExamSuggestions(
  attempts: ExamAttempt[],
  references: AssessmentReference[],
  preferredSubjects: string[],
  limit = 4,
): ExamSuggestion[] {
  if (limit <= 0) return []

  const unique = new Map<string, ExamSuggestion>()
  for (const reference of references) {
    const suggestion: ExamSuggestion = {
      subject: reference.studyName,
      provider: "VCAA",
      examYear: reference.year,
      paper: formatReferenceName(reference.name),
      marks: reference.maxScore,
    }
    const key = suggestionKey(suggestion)
    if (!unique.has(key)) unique.set(key, suggestion)
  }

  const available = [...unique.values()].filter((suggestion) => !isLogged(suggestion, attempts))
  const latest = findLatestAttempt(attempts)
  const chosen: ExamSuggestion[] = []
  const chosenKeys = new Set<string>()
  const add = (items: ExamSuggestion[]) => {
    for (const item of items) {
      if (chosen.length >= limit) return
      const key = suggestionKey(item)
      if (chosenKeys.has(key)) continue
      chosenKeys.add(key)
      chosen.push(item)
    }
  }
  const byYearAscending = (first: ExamSuggestion, second: ExamSuggestion) =>
    first.examYear - second.examYear || paperOrder(first.paper) - paperOrder(second.paper) || first.paper.localeCompare(second.paper)
  const byYearDescending = (first: ExamSuggestion, second: ExamSuggestion) =>
    second.examYear - first.examYear || paperOrder(first.paper) - paperOrder(second.paper) || first.paper.localeCompare(second.paper)

  if (latest) {
    const latestSubject = normaliseComparisonName(latest.subject)
    const sameSubject = available.filter((item) => normaliseComparisonName(item.subject) === latestSubject)
    add(sameSubject.filter((item) => item.examYear > latest.examYear).toSorted(byYearAscending))
    add(sameSubject.filter((item) => item.examYear === latest.examYear).toSorted(byYearAscending))
    add(sameSubject.filter((item) => item.examYear < latest.examYear).toSorted(byYearDescending))
  }

  const preferences = new Map(preferredSubjects.map((subject, index) => [normaliseComparisonName(subject), index]))
  add(available.toSorted((first, second) =>
    (preferences.get(normaliseComparisonName(first.subject)) ?? Number.MAX_SAFE_INTEGER) -
      (preferences.get(normaliseComparisonName(second.subject)) ?? Number.MAX_SAFE_INTEGER) ||
    byYearDescending(first, second) ||
    first.subject.localeCompare(second.subject),
  ))

  return chosen
}
