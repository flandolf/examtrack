import { writeFileSync } from "node:fs"

const BASE = "https://www.vcaa.vic.edu.au"
const INDEX = `${BASE}/assessment/vce/examination-specifications-past-examinations-and-examination-reports/examination-specifications-past-examinations-and-external-assessment-reports`

function text(value) {
  return value.replace(/<[^>]+>/g, " ").replaceAll("&amp;", "&").replaceAll("&nbsp;", " ").replaceAll("&#39;", "'").replace(/\s+/g, " ").trim()
}

function absoluteUrl(value) {
  return new URL(value, BASE).href
}

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: absoluteUrl(match[1]), label: text(match[2]) }))
}

export function parseStudyIndex(html) {
  const prefix = `${BASE}/assessment/vce/examination-specifications-past-examinations-and-examination-reports/`
  return anchors(html).filter((link) => link.url.startsWith(prefix) && link.url !== INDEX && link.label)
    .filter((link, index, all) => all.findIndex((item) => item.url === link.url) === index)
    .map((link) => ({ studyName: link.label, pageUrl: link.url }))
}

export function parseStudyResources(html) {
  return anchors(html).flatMap((link) => {
    if (!/\.(pdf|docx?|zip)(\?|$)/i.test(link.url) || !link.label) return []
    const label = link.label.replace(/\([^)]*\b(?:KB|MB)\b[^)]*\)/gi, "").trim()
    const lower = label.toLowerCase()
    const kind = /specification/.test(lower) ? "specification"
      : /report|assessment guide|criteria|expected qualities/.test(lower) ? "report"
      : /sample|answer book|answer sheet/.test(lower) ? "sample"
      : /exam|examination/.test(lower) ? "exam"
      : "other"
    const year = Number(label.match(/\b(20\d{2})\b/)?.[1]) || null
    return [{ label, url: link.url, kind, year }]
  }).filter((link, index, all) => all.findIndex((item) => item.url === link.url) === index)
}

async function main() {
  const indexHtml = await fetch(INDEX).then((response) => {
    if (!response.ok) throw new Error(`VCAA index returned ${response.status}`)
    return response.text()
  })
  const pages = parseStudyIndex(indexHtml)
  const studies = []
  for (let index = 0; index < pages.length; index += 8) {
    const batch = await Promise.all(pages.slice(index, index + 8).map(async (study) => {
      try {
        const html = await fetch(study.pageUrl).then((response) => response.ok ? response.text() : Promise.reject(new Error(String(response.status))))
        return { ...study, resources: parseStudyResources(html) }
      } catch {
        return { ...study, resources: [] }
      }
    }))
    studies.push(...batch)
  }
  const output = { parserVersion: "vcaa-exam-resources-v1", generatedAt: new Date().toISOString(), sourceUrl: INDEX, studies }
  writeFileSync("public/vcaa-exam-resources.json", `${JSON.stringify(output, null, 2)}\n`)
  process.stderr.write(`Imported ${studies.reduce((total, study) => total + study.resources.length, 0)} resources across ${studies.length} studies.\n`)
}

if (import.meta.main) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1 })
