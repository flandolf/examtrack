import { useEffect, useState } from "react"

import type { AssessmentReference } from "@/lib/exam-data"
import type { ScalingReference } from "@/lib/scaling"
import { loadTimetable, type Timetable } from "@/lib/timetable"
import type { VcaaStudyResources } from "@/lib/vcaa-resources"

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`${url} request failed with ${response.status}`)
  return response.json() as Promise<T>
}

export function useReferenceData() {
  const [references, setReferences] = useState<AssessmentReference[]>([])
  const [referencesGeneratedAt, setReferencesGeneratedAt] = useState<string | null>(null)
  const [resourceStudies, setResourceStudies] = useState<VcaaStudyResources[]>([])
  const [resourcesGeneratedAt, setResourcesGeneratedAt] = useState<string | null>(null)
  const [scalingReferences, setScalingReferences] = useState<ScalingReference[]>([])
  const [timetable, setTimetable] = useState<Timetable | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    void fetchJson<{ generatedAt?: string; assessments?: AssessmentReference[] }>(
      "/vcaa-grade-distributions.json",
      controller.signal,
    ).then((result) => {
      if (!active) return
      setReferences(Array.isArray(result.assessments) ? result.assessments : [])
      setReferencesGeneratedAt(typeof result.generatedAt === "string" ? result.generatedAt : null)
    }).catch(() => undefined)

    void fetchJson<{ generatedAt?: string; studies?: VcaaStudyResources[] }>(
      "/vcaa-exam-resources.json",
      controller.signal,
    ).then((result) => {
      if (!active) return
      setResourceStudies(Array.isArray(result.studies) ? result.studies : [])
      setResourcesGeneratedAt(typeof result.generatedAt === "string" ? result.generatedAt : null)
    }).catch(() => undefined)

    void fetchJson<{ references?: ScalingReference[] }>(
      "/vtac-scaling-reports.json",
      controller.signal,
    ).then((result) => {
      if (active) setScalingReferences(Array.isArray(result.references) ? result.references : [])
    }).catch(() => undefined)

    void loadTimetable().then((result) => {
      if (active) setTimetable(result)
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return {
    references,
    referencesGeneratedAt,
    resourceStudies,
    resourcesGeneratedAt,
    scalingReferences,
    timetable,
  }
}
