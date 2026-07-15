import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ATAR_AGGREGATE_REFERENCES } from "@/lib/atar-data"
import { estimateAtar, type AtarStudyResult } from "@/lib/atar"
import { normaliseComparisonName, type AppData, type AssessmentReference } from "@/lib/exam-data"
import { interpolateScaledScore, type ScalingReference } from "@/lib/scaling"
import { predictStudyScore } from "@/lib/study-score"

type Row = {
  id: string
  code: string
  raw: string
  usePrediction: boolean
}

function newRow(code = ""): Row {
  return { id: crypto.randomUUID(), code, raw: "", usePrediction: true }
}

export function AtarEstimator({
  data,
  references,
  scalingReferences,
}: {
  data: AppData
  references: AssessmentReference[]
  scalingReferences: ScalingReference[]
}) {
  const years = useMemo(
    () => ATAR_AGGREGATE_REFERENCES.map((item) => item.year)
      .filter((year) => scalingReferences.some((reference) => reference.year === year))
      .toSorted((a, b) => b - a),
    [scalingReferences],
  )
  const [year, setYear] = useState(years[0] ?? 2025)
  const studies = useMemo(
    () => scalingReferences.filter((reference) => reference.year === year)
      .toSorted((a, b) => a.studyName.localeCompare(b.studyName)),
    [scalingReferences, year],
  )
  const [rows, setRows] = useState<Row[]>(() => [newRow()])

  const predictions = useMemo(() => {
    const map = new Map<string, number>()
    for (const subject of new Set(data.attempts.map((attempt) => attempt.subject))) {
      const prediction = predictStudyScore({ subject, attempts: data.attempts, references })
      if (prediction) map.set(normaliseComparisonName(subject), prediction.studyScore)
    }
    return map
  }, [data.attempts, references])

  const results = useMemo<AtarStudyResult[]>(() => rows.flatMap((row) => {
    const reference = studies.find((item) => item.code === row.code)
    if (!reference) return []
    const predicted = predictions.get(normaliseComparisonName(reference.studyName))
    const rawScore = row.usePrediction && predicted !== undefined ? predicted : Number(row.raw)
    const scaledScore = interpolateScaledScore(rawScore, reference.points)
    if (scaledScore === null) return []
    return [{ id: row.id, code: reference.code, studyName: reference.studyName, rawScore, scaledScore }]
  }), [predictions, rows, studies])

  const estimate = useMemo(() => estimateAtar(results, year), [results, year])

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  return (
    <section className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">ATAR estimator</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter at least four Unit 3/4 studies including an English-group study. ExamTrack predictions are used when available, but every score can be entered manually.</p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div><CardTitle>Studies</CardTitle><CardDescription>Scaling and aggregate conversion use the same report year.</CardDescription></div>
              <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger className="w-28" aria-label="VTAC report year"><SelectValue>{year}</SelectValue></SelectTrigger>
                <SelectContent>{years.map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rows.map((row) => {
              const reference = studies.find((item) => item.code === row.code)
              const prediction = reference ? predictions.get(normaliseComparisonName(reference.studyName)) : undefined
              const result = results.find((item) => item.id === row.id)
              const usePrediction = row.usePrediction && prediction !== undefined
              return (
                <div key={row.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(14rem,1fr)_9rem_7rem_7rem_auto] md:items-end">
                  <label className="grid gap-1.5 text-sm font-medium">Subject
                    <Select value={row.code} onValueChange={(value) => updateRow(row.id, { code: value ?? "" })}>
                      <SelectTrigger><SelectValue>{reference?.studyName ?? "Select subject"}</SelectValue></SelectTrigger>
                      <SelectContent>{studies.map((item) => <SelectItem key={item.code} value={item.code}>{item.studyName}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">Source
                    <Select value={usePrediction ? "prediction" : "manual"} onValueChange={(value) => updateRow(row.id, { usePrediction: value === "prediction" })}>
                      <SelectTrigger><SelectValue>{usePrediction ? "ExamTrack" : "Manual"}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prediction" disabled={prediction === undefined}>ExamTrack{prediction === undefined ? " unavailable" : ""}</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">Raw
                    <Input type="number" min="20" max="50" step="1" value={usePrediction ? String(prediction) : row.raw} disabled={usePrediction} placeholder="20–50" onChange={(event) => updateRow(row.id, { raw: event.target.value })} />
                  </label>
                  <div><p className="mb-1.5 text-sm font-medium">Scaled</p><div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm tabular-nums">{result ? result.scaledScore.toFixed(1) : "—"}</div></div>
                  <Button variant="ghost" size="icon" aria-label="Remove subject" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 /></Button>
                </div>
              )
            })}
            <Button variant="outline" className="justify-self-start" onClick={() => setRows((current) => [...current, newRow()])}><Plus />Add subject</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Estimated ATAR</CardTitle><CardDescription>{year} VTAC scaling and aggregate reference</CardDescription></CardHeader>
          <CardContent className="grid gap-5">
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ATAR</p><p className="text-6xl font-semibold tracking-tight tabular-nums">{estimate?.atarLabel ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Aggregate</p><p className="text-2xl font-semibold tabular-nums">{estimate?.aggregate.toFixed(2) ?? "—"}</p></div>
            {estimate ? (
              <div className="grid gap-2">
                {[...estimate.primaryFour, ...estimate.increments].map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.studyName}</p><p className="text-xs text-muted-foreground">raw {item.rawScore} · scaled {item.scaledScore.toFixed(1)}</p></div>
                    <Badge variant={item.role === "Increment" ? "secondary" : "outline"}>{item.role}</Badge>
                    <span className="w-12 text-right tabular-nums">{item.contribution.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Add four valid scores, including English, to calculate an estimate.</p>}
          </CardContent>
        </Card>
      </div>

      <Alert><AlertTitle>Historical estimate only</AlertTitle><AlertDescription>VTAC recalculates scaling and the aggregate-to-ATAR table every year. Scores below 20 are not scaled, and course eligibility still depends on prerequisites and selection requirements.</AlertDescription></Alert>
    </section>
  )
}
