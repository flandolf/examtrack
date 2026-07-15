import { useMemo, useState } from "react"
import { ExternalLink, Play, Search } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { formatReferenceName, normaliseComparisonName, type AssessmentReference } from "@/lib/exam-data"
import type { ExamTimerPreset } from "@/components/exam-timer"
import { formatReferenceFreshness, getVcaaExamResourcesUrl, type VcaaResource, type VcaaStudyResources } from "@/lib/vcaa-resources"

function pickResource(resources: VcaaResource[], kind: VcaaResource["kind"], reference: AssessmentReference) {
  const candidates = resources.filter((resource) => resource.kind === kind && (resource.year === reference.year || resource.year === null))
  const paper = normaliseComparisonName(reference.name)
  return candidates.find((resource) => normaliseComparisonName(resource.label).includes(paper)) ?? candidates[0]
}

export function ExamLibrary({ references, studies, generatedAt, onStart }: { references: AssessmentReference[]; studies: VcaaStudyResources[]; generatedAt: string | null; onStart: (preset: ExamTimerPreset) => void }) {
  const subjects = useMemo(() => [...new Set(references.map((reference) => reference.studyName))].toSorted(), [references])
  const [subject, setSubject] = useState("all")
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => references.filter((reference) =>
    (subject === "all" || reference.studyName === subject) &&
    `${reference.studyName} ${reference.year} ${reference.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  ).toSorted((first, second) => second.year - first.year || first.name.localeCompare(second.name)), [query, references, subject])
  const visible = filtered.slice(0, 60)
  const resourcesByStudy = useMemo(() => new Map(studies.map((study) => [normaliseComparisonName(study.studyName), study])), [studies])

  return (
    <div className="grid gap-6">
      <PageHeader title="Exam library" description="Choose an official VCAA assessment reference, open the source material, or launch a correctly named timed attempt." />
      <Alert>
        <Search />
        <AlertTitle>Confirm the current study design before using an older paper</AlertTitle>
        <AlertDescription>VCAA publishes examination specifications, sample papers, assessment guides and external assessment reports on each study page. <a className="font-medium underline underline-offset-4" href={getVcaaExamResourcesUrl()} target="_blank" rel="noreferrer">Browse official study resources</a>.</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Select value={subject} onValueChange={(value) => setSubject(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-72" aria-label="Filter library by subject"><SelectValue>{subject === "all" ? "All subjects" : subject}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="w-full sm:max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, year or paper" aria-label="Search exam library" />
        <span className="self-center text-sm text-muted-foreground">{formatReferenceFreshness(generatedAt)}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((reference) => {
          const study = resourcesByStudy.get(normaliseComparisonName(reference.studyName))
          const exam = pickResource(study?.resources ?? [], "exam", reference)
          const report = pickResource(study?.resources ?? [], "report", reference)
          const specification = pickResource(study?.resources ?? [], "specification", reference)
          return (
          <Card key={reference.id} className="min-w-0">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><CardTitle>{reference.studyName}</CardTitle><CardDescription>{reference.year} · {formatReferenceName(reference.name)}</CardDescription></div>
                <Badge variant="outline">{reference.maxScore} marks</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => onStart({ subject: reference.studyName, provider: "VCAA", examYear: reference.year, paper: formatReferenceName(reference.name), marks: reference.maxScore })}><Play />Start timed attempt</Button>
              {exam ? <Button variant="outline" render={<a href={exam.url} target="_blank" rel="noreferrer" />}><ExternalLink />Exam paper</Button> : null}
              {report ? <Button variant="outline" render={<a href={report.url} target="_blank" rel="noreferrer" />}><ExternalLink />Examiner report</Button> : null}
              {specification ? <Button variant="ghost" render={<a href={specification.url} target="_blank" rel="noreferrer" />}><ExternalLink />Specifications</Button> : null}
              <Button variant="ghost" render={<a href={reference.sourceUrl} target="_blank" rel="noreferrer" />}><ExternalLink />Distribution</Button>
            </CardContent>
          </Card>
        )})}
      </div>
      {filtered.length > visible.length ? <p className="text-center text-sm text-muted-foreground">Showing the first {visible.length} results. Choose a subject or refine the search.</p> : null}
      {!filtered.length ? <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No matching VCAA assessment references.</p> : null}
    </div>
  )
}
