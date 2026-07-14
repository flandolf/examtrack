import type { Mistake } from "@/lib/exam-data"

export function buildRevisionPriorities(mistakes: Mistake[]) {
  const counts = new Map<string, { category: string; unresolved: number; resolved: number }>()
  for (const mistake of mistakes) {
    const entry = counts.get(mistake.category) ?? { category: mistake.category, unresolved: 0, resolved: 0 }
    entry[mistake.resolved ? "resolved" : "unresolved"] += 1
    counts.set(mistake.category, entry)
  }
  return [...counts.values()].toSorted(
    (first, second) => second.unresolved - first.unresolved ||
      second.unresolved + second.resolved - (first.unresolved + first.resolved),
  )
}

export function buildRevisionQueue(mistakes: Mistake[]) {
  const rank = new Map(buildRevisionPriorities(mistakes).map((item, index) => [item.category, index]))
  return mistakes.filter((mistake) => !mistake.resolved).toSorted(
    (first, second) => (rank.get(first.category) ?? 0) - (rank.get(second.category) ?? 0) ||
      first.updatedAt.localeCompare(second.updatedAt),
  )
}
