import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { interpolateScaledScore, predictScaledStudyScore, type ScalingReference } from "../src/lib/scaling"
import { parseScalingReportText } from "../vtac/import-scaling-reports.mjs"

const points = [20, 25, 30, 35, 40, 45, 50].map((rawScore, index) => ({
  rawScore,
  scaledScore: [21, 28, 35, 41, 46, 49, 51][index],
}))

describe("VTAC scaling", () => {
  test("parses a scaling row extracted from the official PDF", () => {
    const references = parseScalingReportText({
      year: 2025,
      url: "https://example.test/scaling.pdf",
      text: "NJ Mathematical Methods 34.4 8.4 21 28 35 41 46 49 51",
    })
    expect(references).toEqual([expect.objectContaining({
      code: "NJ",
      studyName: "Mathematical Methods",
      year: 2025,
      points,
    })])
  })

  test("interpolates between the raw scores published by VTAC", () => {
    expect(interpolateScaledScore(40, points)).toBe(46)
    expect(interpolateScaledScore(42.5, points)).toBe(47.5)
    expect(interpolateScaledScore(19, points)).toBeNull()
  })

  test("averages matching estimates across available report years", () => {
    const references: ScalingReference[] = [
      { id: "NJ:2024", code: "NJ", studyName: "Mathematical Methods", year: 2024, mean: 34, standardDeviation: 8, sourceUrl: "2024.pdf", points },
      { id: "NJ:2025", code: "NJ", studyName: "Mathematical Methods", year: 2025, mean: 34, standardDeviation: 8, sourceUrl: "2025.pdf", points: points.map((point) => ({ ...point, scaledScore: point.scaledScore + 1 })) },
    ]
    expect(predictScaledStudyScore(40, "Mathematical Methods", references)).toMatchObject({
      scaledScore: 46.5,
      minimum: 46,
      maximum: 47,
    })
  })

  test("bundles valid and unique 2021–2025 scaling references", () => {
    const data = JSON.parse(readFileSync(new URL("../public/vtac-scaling-reports.json", import.meta.url), "utf8")) as {
      references: ScalingReference[]
    }
    expect(data.references.length).toBeGreaterThan(400)
    expect(new Set(data.references.map((reference) => reference.id)).size).toBe(data.references.length)
    expect([...new Set(data.references.map((reference) => reference.year))].toSorted()).toEqual([2021, 2022, 2023, 2024, 2025])
    expect(data.references.filter((reference) => reference.studyName === "Mathematical Methods")).toHaveLength(5)
    expect(data.references.every((reference) => reference.points.length === 7)).toBe(true)
  })
})
