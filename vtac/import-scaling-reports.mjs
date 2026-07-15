import { writeFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

const REPORTS = [
  { year: 2025, url: "https://vtac.edu.au/files/pdf/reports/scaling-report-25.pdf" },
  { year: 2024, url: "https://vtac.edu.au/files/pdf/reports/scaling-report-24.pdf" },
  { year: 2023, url: "https://vtac.edu.au/files/pdf/reports/scaling-report-23-24.pdf" },
  { year: 2022, url: "https://vtac.edu.au/files/pdf/reports/scaling-report-22-23.pdf" },
  { year: 2021, url: "https://vtac.edu.au/files/pdf/reports/scaling-report-21-22.pdf" },
]
const RAW_SCORES = [20, 25, 30, 35, 40, 45, 50]
const DEFAULT_OUT = "public/vtac-scaling-reports.json"
const PARSER_VERSION = "vtac-scaling-pdf-v1"
const STANDARD_FONT_DATA_URL = `${resolve("node_modules/pdfjs-dist/standard_fonts")}${sep}`

async function main() {
  const output = resolve(process.argv[2] ?? DEFAULT_OUT)
  const references = []
  for (const report of REPORTS) {
    const response = await fetch(report.url, {
      headers: { "user-agent": "Mozilla/5.0 ExamTrack scaling importer" },
    })
    if (!response.ok) throw new Error(`Failed to fetch ${report.url}: ${response.status}`)
    const text = await extractPdfText(await response.arrayBuffer())
    const parsed = parseScalingReportText({ ...report, text })
    if (parsed.length < 50) throw new Error(`Only parsed ${parsed.length} studies for ${report.year}`)
    references.push(...parsed)
    process.stderr.write(`Parsed ${parsed.length} scaling rows for ${report.year}.\n`)
  }

  writeFileSync(output, `${JSON.stringify({
    parserVersion: PARSER_VERSION,
    generatedAt: new Date().toISOString(),
    reports: REPORTS,
    references,
  }, null, 2)}\n`)
  process.stderr.write(`Wrote ${output}\n`)
}

async function extractPdfText(buffer) {
  const document = await getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const rows = new Map()
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 2) * 2
      const row = rows.get(y) ?? []
      row.push({ x: item.transform[4], text: item.str })
      rows.set(y, row)
    }
    pages.push([...rows.entries()]
      .sort(([first], [second]) => second - first)
      .map(([, row]) => row.toSorted((a, b) => a.x - b.x).map((item) => item.text).join(" "))
      .join("\n"))
  }
  return pages.join("\n")
}

function parseScalingReportText({ year, url, text }) {
  const rowPattern = /^\s*([A-Z]{1,4}\d{0,2})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$/
  const references = []
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(rowPattern)
    if (!match) continue
    const [, code, studyName, mean, standardDeviation, ...scaledScores] = match
    references.push({
      id: `${code}:${year}`,
      code,
      studyName: studyName.replace(/\s+/g, " ").trim(),
      year,
      mean: Number(mean),
      standardDeviation: Number(standardDeviation),
      sourceUrl: url,
      points: RAW_SCORES.map((rawScore, index) => ({
        rawScore,
        scaledScore: Number(scaledScores[index]),
      })),
    })
  }
  return references
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

export { parseScalingReportText }
