import { lazy, Suspense, useMemo } from "react"
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  FilePlus2,
  NotebookPen,
  Plus,
  Target,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  analyseAttempt,
  matchesAttemptReference,
  type AppData,
  type AssessmentReference,
  type ExamAttempt,
} from "@/lib/exam-data"
import type { Timetable } from "@/lib/timetable"
import { PageHeader } from "@/components/page-header"
import { UpcomingExamsCard } from "@/components/upcoming-exams-card"
import { ExamTable } from "@/components/exam-table"
import { getExamTarget } from "@/lib/exam-target"

const PerformanceTrendChart = lazy(() =>
  import("@/components/performance-trend-chart").then((module) => ({ default: module.PerformanceTrendChart })),
)
const RevisionPriorityChart = lazy(() =>
  import("@/components/revision-priority-chart").then((module) => ({ default: module.RevisionPriorityChart })),
)
const SubjectBenchmarkChart = lazy(() =>
  import("@/components/subject-benchmark-chart").then((module) => ({ default: module.SubjectBenchmarkChart })),
)
const VcaaPercentileTrendChart = lazy(() =>
  import("@/components/vcaa-percentile-trend-chart").then((module) => ({ default: module.VcaaPercentileTrendChart })),
)

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type NextAction = {
  icon: LucideIcon
  title: string
  description: string
  cta: string
  onClick: () => void
}

function pickNextAction(
  data: AppData,
  handlers: {
    onLogExam: () => void
    onLogMistakeForLatest: () => void
    onOpenMistakes: () => void
  },
): NextAction | null {
  if (data.attempts.length === 0) {
    return {
      icon: FilePlus2,
      title: "Log your first practice exam",
      description:
        "Recording a completed paper unlocks trend tracking, official comparisons, and the mistake workflow.",
      cta: "Log first exam",
      onClick: handlers.onLogExam,
    }
  }

  const unresolved = data.mistakes.filter((mistake) => !mistake.resolved)
  if (unresolved.length > 0) {
    const counts = new Map<string, number>()
    for (const mistake of unresolved) counts.set(mistake.category, (counts.get(mistake.category) ?? 0) + 1)
    let topCategory: string | null = null
    let topCount = 0
    for (const [category, count] of counts) {
      if (count > topCount) {
        topCategory = category
        topCount = count
      }
    }
    const noun = topCount === 1 ? "mistake" : "mistakes"
    return {
      icon: Target,
      title: `Review ${topCount} unresolved ${topCategory?.toLowerCase()} ${noun}`,
      description: "Your most common category — resolving these tightens every future attempt you sit.",
      cta: "Open Mistakes",
      onClick: handlers.onOpenMistakes,
    }
  }

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const recent = data.attempts.some(
    (attempt) => new Date(`${attempt.completedAt}T00:00:00`).getTime() >= cutoff,
  )
  if (!recent) {
    return {
      icon: BookOpenCheck,
      title: "It's been a while since your last paper",
      description: "A fresh result keeps your trend curve honest and surfaces what you actually remember today.",
      cta: "Log exam",
      onClick: handlers.onLogExam,
    }
  }

  if (data.mistakes.length === 0) {
    return {
      icon: NotebookPen,
      title: "Capture a mistake from your latest exam",
      description: "Even one well-described error becomes a revision anchor you can return to before the next paper.",
      cta: "Log mistake",
      onClick: handlers.onLogMistakeForLatest,
    }
  }

  return null
}

function computeStats(attempts: ExamAttempt[]) {
  if (attempts.length === 0) {
    return { count: 0, subjects: 0, average: 0, best: 0, trendDiff: 0, trend: "flat" as const, lastDate: null }
  }
  const subjects = new Set(attempts.map((attempt) => attempt.subject))
  const sorted = [...attempts].toSorted((first, second) =>
    first.completedAt.localeCompare(second.completedAt),
  )
  const pcts = sorted.map((attempt) => (attempt.rawScore / attempt.rawMax) * 100)
  const average = pcts.reduce((total, value) => total + value, 0) / pcts.length
  const best = Math.max(...pcts)
  let trend: "up" | "down" | "flat" = "flat"
  let trendDiff = 0
  if (pcts.length >= 2) {
    const split = Math.max(1, Math.floor(pcts.length / 2))
    const prior = pcts.slice(0, split).reduce((total, value) => total + value, 0) / split
    const recent = pcts.slice(split).reduce((total, value) => total + value, 0) / (pcts.length - split)
    trendDiff = recent - prior
    if (trendDiff > 0.5) trend = "up"
    else if (trendDiff < -0.5) trend = "down"
  }
  return {
    count: attempts.length,
    subjects: subjects.size,
    average,
    best,
    trendDiff,
    trend,
    lastDate: sorted[sorted.length - 1].completedAt,
  }
}

function computeSubjectBreakdown(data: AppData, references: AssessmentReference[]) {
  const buckets = new Map<
    string,
    { count: number; pctSum: number; lastDate: string; linkedCount: number }
  >()
  for (const attempt of data.attempts) {
    const bucket = buckets.get(attempt.subject) ?? {
      count: 0,
      pctSum: 0,
      lastDate: "",
      linkedCount: 0,
    }
    bucket.count += 1
    bucket.pctSum += (attempt.rawScore / attempt.rawMax) * 100
    if (attempt.completedAt > bucket.lastDate) bucket.lastDate = attempt.completedAt
    const direct = references.find(
      (reference) => reference.year === attempt.examYear && matchesAttemptReference(attempt, reference),
    )
    const linked = direct ?? (attempt.referenceId
      ? references.find((reference) => reference.id === attempt.referenceId)
      : undefined)
    if (linked) bucket.linkedCount += 1
    buckets.set(attempt.subject, bucket)
  }
  return [...buckets.entries()]
    .map(([subject, bucket]) => ({
      subject,
      count: bucket.count,
      average: bucket.pctSum / bucket.count,
      lastDate: bucket.lastDate,
      linkedCount: bucket.linkedCount,
    }))
    .toSorted((first, second) => second.average - first.average)
}

function NextActionNotice({ action }: { action: NextAction | null }) {
  if (!action) return null
  const Icon = action.icon
  return (
    <section
      aria-label="Next study action"
      className="flex flex-wrap items-start gap-4 rounded-lg border border-dashed bg-accent/40 px-5 py-4 sm:flex-nowrap sm:items-center"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-foreground/10">
        <Icon className="size-4 text-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium leading-snug text-balance">{action.title}</p>
        <p className="text-sm text-muted-foreground leading-snug text-pretty">{action.description}</p>
      </div>
      <Button onClick={action.onClick} className="shrink-0 sm:ml-auto">
        {action.cta}
        <ArrowRight aria-hidden />
      </Button>
    </section>
  )
}

function StatRow({ data }: { data: AppData }) {
  const stats = useMemo(() => computeStats(data.attempts), [data.attempts])
  const resolved = data.mistakes.filter((mistake) => mistake.resolved).length
  const total = data.mistakes.length
  const unresolved = total - resolved
  const completion = total ? (resolved / total) * 100 : 0

  return (
    <div className="grid gap-5 rounded-lg border bg-card px-5 py-5 sm:grid-cols-2 sm:gap-y-6 lg:grid-cols-4 lg:gap-y-0 lg:divide-x lg:divide-border">
      <div className="flex min-w-0 flex-col gap-1.5 sm:pr-6">
        <p className="text-sm text-muted-foreground">Practice exams</p>
        <p className="text-3xl font-semibold tabular-nums leading-none">{stats.count}</p>
        <p className="text-xs text-muted-foreground">
          {stats.count === 0
            ? "Log your first paper to begin"
            : `${stats.subjects} subject${stats.subjects === 1 ? "" : "s"}`}
          {stats.lastDate ? ` · last ${formatDate(stats.lastDate)}` : null}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:pl-6 lg:px-6">
        <p className="text-sm text-muted-foreground">Average mark</p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tabular-nums leading-none">
            {stats.count === 0 ? "—" : `${stats.average.toFixed(1)}%`}
          </p>
          {stats.count >= 2 && stats.trend !== "flat" ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground tabular-nums">
              {stats.trend === "up" ? (
                <ArrowUpRight className="size-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="size-3.5" aria-hidden />
              )}
              {stats.trend === "up" ? "+" : ""}
              {stats.trendDiff.toFixed(1)}%
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {stats.count < 2
            ? "Track another attempt to surface a trend"
            : stats.trend === "flat"
              ? "Stable across your recent attempts"
              : stats.trend === "up"
                ? "Improving vs your earlier half"
                : "Dropping vs your earlier half"}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 lg:px-6">
        <p className="text-sm text-muted-foreground">Best mark</p>
        <p className="text-3xl font-semibold tabular-nums leading-none">{stats.best.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground">Your strongest recorded practice result</p>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:pl-6">
        <p className="text-sm text-muted-foreground">Mistakes</p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tabular-nums leading-none">{total === 0 ? "—" : unresolved}</p>
          <p className="text-xs text-muted-foreground">
            {total === 0 ? "none logged" : `unresolved of ${total}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={completion} className="w-24" />
          <span className="text-xs text-muted-foreground tabular-nums">
            {total === 0 ? "0/0" : `${resolved}/${total} resolved`}
          </span>
        </div>
      </div>
    </div>
  )
}

function SubjectBreakdown({ data, references }: { data: AppData; references: AssessmentReference[] }) {
  const breakdown = useMemo(() => computeSubjectBreakdown(data, references), [data, references])
  if (breakdown.length === 0) return null
  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle>Subjects</CardTitle>
        <CardDescription>
          Average mark per subject — the Est. badge marks results linked to an official distribution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y rounded-lg border" role="list">
          {breakdown.map((entry) => (
            <li key={entry.subject} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium">{entry.subject}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {entry.count} attempt{entry.count === 1 ? "" : "s"}
                  {entry.lastDate ? ` · last ${formatDate(entry.lastDate)}` : ""}
                  {entry.linkedCount > 0 ? <> · {entry.linkedCount} linked</> : null}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">{entry.average.toFixed(1)}%</span>
                {entry.linkedCount > 0 ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Est.
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function RecentExams({
  data,
  references,
  onLogExam,
}: {
  data: AppData
  references: AssessmentReference[]
  onLogExam: () => void
}) {
  const recent = useMemo(
    () =>
      [...data.attempts]
        .toSorted((first, second) => second.completedAt.localeCompare(first.completedAt))
        .slice(0, 5),
    [data.attempts],
  )
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle>Recent exams</CardTitle>
            <CardDescription>Your latest five recorded attempts.</CardDescription>
          </div>
          <Button variant="outline" size="sm" render={<a href="#all-exams" />}>
            View all
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length ? (
          <ul className="flex flex-col divide-y rounded-lg border" role="list">
            {recent.map((attempt) => {
              const reference =
                references.find(
                  (item) =>
                    item.year === attempt.examYear && matchesAttemptReference(attempt, item),
                ) ?? (attempt.referenceId
                  ? references.find((item) => item.id === attempt.referenceId)
                  : undefined)
              const analysis = analyseAttempt(attempt, reference)
              return (
                <li key={attempt.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">{attempt.title} · {attempt.paper}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(attempt.completedAt)}</p>
                  </div>
                  {reference && analysis.grade ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{analysis.grade}</Badge>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        Est.
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {analysis.percentile?.toFixed(0)}th pctile
                      </span>
                    </div>
                  ) : null}
                  <Button variant="ghost" size="sm" className="shrink-0" render={<a href={`#${getExamTarget(attempt.id)}`} />}>
                    Go to exam
                    <ArrowDownRight aria-hidden />
                  </Button>
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums">
                    {attempt.rawScore}/{attempt.rawMax}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {analysis.percentage.toFixed(1)}%
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FilePlus2 />
              </EmptyMedia>
              <EmptyTitle>No exams yet</EmptyTitle>
              <EmptyDescription>Log a completed paper to start tracking performance.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={onLogExam}>
                <Plus />
                Log first exam
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}

export type DashboardProps = {
  data: AppData
  references: AssessmentReference[]
  timetable: Timetable | null
  onLogExam: () => void
  onLogMistakeForLatest: () => void
  onOpenMistakes: () => void
  onOpenTracker: () => void
  onEditExam: (attempt: ExamAttempt) => void
  onAddMistake: (attemptId: string) => void
  onDeleteExam: (attempt: ExamAttempt) => void
}

export function Dashboard(props: DashboardProps) {
  const {
    data,
    references,
    timetable,
    onLogExam,
    onLogMistakeForLatest,
    onOpenMistakes,
    onOpenTracker,
    onEditExam,
    onAddMistake,
    onDeleteExam,
  } = props
  const nextAction = useMemo(
    () => pickNextAction(data, { onLogExam, onLogMistakeForLatest, onOpenMistakes }),
    [data, onLogExam, onLogMistakeForLatest, onOpenMistakes],
  )

  const deadlineSection = timetable ? (
    <UpcomingExamsCard
      entries={timetable.exams}
      trackedIds={data.trackedExamIds}
      onOpenPicker={onOpenTracker}
      sourceUrl={timetable.sourceUrl}
    />
  ) : null

  if (data.attempts.length === 0) {
    return (
      <div className="grid gap-6">
        <PageHeader
          title="Dashboard"
          description="Your practice exam results and the mistakes worth revisiting."
        >
          <Button onClick={onLogExam}>
            <Plus />
            Log exam
          </Button>
        </PageHeader>
        {deadlineSection}
        <Empty className="min-h-[24rem] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenCheck />
            </EmptyMedia>
            <EmptyTitle>Log a practice exam to begin</EmptyTitle>
            <EmptyDescription>
              Record a raw mark, link an official grade distribution when one exists, and capture mistakes
              worth revisiting before your next paper.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" onClick={onLogExam}>
              <Plus />
              Log first exam
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Dashboard"
        description="Your practice exam results and the mistakes worth revisiting."
      >
        <Button onClick={onLogExam}>
          <Plus />
          Log exam
        </Button>
      </PageHeader>

      <RecentExams data={data} references={references} onLogExam={onLogExam} />

      {/* Deadlines and the next study action are both study signals -- stack them above stats. */}
      {deadlineSection}
      <NextActionNotice action={nextAction} />

      <StatRow data={data} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PerformanceTrendChart attempts={data.attempts} references={references} />
          </Suspense>
        </div>
        <div className="min-w-0">
          <SubjectBreakdown data={data} references={references} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <SubjectBenchmarkChart attempts={data.attempts} references={references} mistakes={data.mistakes} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <VcaaPercentileTrendChart attempts={data.attempts} references={references} />
        </Suspense>
      </div>

      <div className="min-w-0">
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <RevisionPriorityChart mistakes={data.mistakes} />
        </Suspense>
      </div>

      <ExamTable attempts={data.attempts} references={references} onEdit={onEditExam} onAddMistake={onAddMistake} onDelete={onDeleteExam} />
    </div>
  )
}
