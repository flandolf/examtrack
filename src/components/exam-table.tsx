import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, CircleAlert, MoreHorizontal } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { analyseAttempt, findAttemptReferenceForYear, type AssessmentReference, type ExamAttempt } from "@/lib/exam-data"
import { getExamIdFromHash, getExamTarget } from "@/lib/exam-target"

const AttemptDistributionChart = lazy(() =>
  import("@/components/attempt-distribution-chart").then((module) => ({ default: module.AttemptDistributionChart })),
)

export function ExamTable({
  attempts,
  references,
  comparisonYear,
  onComparisonYearChange,
  onEdit,
  onAddMistake,
  onDelete,
}: {
  attempts: ExamAttempt[]
  references: AssessmentReference[]
  comparisonYear: number
  onComparisonYearChange: (year: number) => void
  onEdit: (attempt: ExamAttempt) => void
  onAddMistake: (attemptId: string) => void
  onDelete: (attempt: ExamAttempt) => void
}) {
  const [query, setQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const comparisonYears = useMemo(
    () => [...new Set(references.map((reference) => reference.year))].toSorted((a, b) => b - a),
    [references],
  )
  const filtered = useMemo(() => attempts
    .filter((attempt) => `${attempt.title} ${attempt.subject} ${attempt.provider} ${attempt.paper}`.toLowerCase().includes(query.toLowerCase()))
    .toSorted((a, b) => b.completedAt.localeCompare(a.completedAt)), [attempts, query])
  useEffect(() => {
    const revealTarget = () => {
      const id = getExamIdFromHash(window.location.hash)
      if (id && attempts.some((attempt) => attempt.id === id)) {
        setQuery("")
        setExpandedId(id)
      }
    }
    revealTarget()
    window.addEventListener("hashchange", revealTarget)
    return () => window.removeEventListener("hashchange", revealTarget)
  }, [attempts])

  return (
    <section id="all-exams" aria-labelledby="all-exams-title" className="grid scroll-mt-20 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="all-exams-title" className="text-lg font-semibold">All exams</h2>
          <p className="text-sm text-muted-foreground">Search, edit, log mistakes, or expand a row for its VCAA distribution.</p>
        </div>
        <Input className="w-full sm:w-80" aria-label="Search exams" placeholder="Search exams…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {filtered.length ? (
        <div className="w-full overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><span className="sr-only">Expand</span></TableHead>
                <TableHead>Exam</TableHead><TableHead>Date</TableHead><TableHead>Mark</TableHead><TableHead>Result</TableHead>
                <TableHead>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span>VCAA comparison</span>
                    <Select value={String(comparisonYear)} onValueChange={(value) => onComparisonYearChange(Number(value))}>
                      <SelectTrigger size="sm" className="w-auto border-0 bg-transparent px-1.5 py-0 text-xs font-medium shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted" aria-label="VCAA comparison year">
                        <SelectValue>{comparisonYear}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="min-w-24">
                        {comparisonYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((attempt) => {
                const reference = findAttemptReferenceForYear(attempt, references, comparisonYear)
                const analysis = analyseAttempt(attempt, reference)
                const expanded = expandedId === attempt.id
                return (
                  <Fragment key={attempt.id}>
                    <TableRow id={getExamTarget(attempt.id)} className="scroll-mt-20 transition-colors target:bg-accent/60">
                      <TableCell className="py-2">
                        <Button variant="ghost" size="icon-sm" aria-expanded={expanded} aria-label={expanded ? "Hide distribution" : "Show distribution"} onClick={() => setExpandedId(expanded ? null : attempt.id)}>
                          {expanded ? <ChevronUp /> : <ChevronDown />}
                        </Button>
                      </TableCell>
                      <TableCell><div className="font-medium">{attempt.title}</div><div className="text-xs text-muted-foreground">{attempt.provider} · {attempt.paper}</div></TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(`${attempt.completedAt}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                      <TableCell className="tabular-nums">{reference ? <><div>{analysis.scaledScore.toFixed(1)}/{reference.maxScore}</div><div className="text-xs text-muted-foreground">{attempt.rawScore}/{attempt.rawMax} raw</div></> : `${attempt.rawScore}/${attempt.rawMax}`}</TableCell>
                      <TableCell className="tabular-nums">{analysis.percentage.toFixed(1)}%</TableCell>
                      <TableCell>{reference && analysis.grade ? <div className="flex items-center gap-2 whitespace-nowrap"><Badge variant="secondary">{analysis.grade}</Badge><span className="text-xs text-muted-foreground">est. {analysis.percentile?.toFixed(0)}th</span></div> : <span className="text-xs text-muted-foreground">Unavailable in {comparisonYear}</span>}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal /><span className="sr-only">Exam actions</span></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(attempt)}>Edit exam</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAddMistake(attempt.id)}>Log mistake</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => onDelete(attempt)}>Delete exam</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expanded ? <TableRow className="bg-muted/30 hover:bg-muted/30"><TableCell colSpan={7} className="p-4"><Suspense fallback={<Skeleton className="h-64 w-full" />}><AttemptDistributionChart attempt={attempt} references={references} comparisonYear={comparisonYear} /></Suspense></TableCell></TableRow> : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Alert><CircleAlert /><AlertTitle>No matching exams</AlertTitle><AlertDescription>Try a different subject, provider, or paper.</AlertDescription></Alert>
      )}
    </section>
  )
}
