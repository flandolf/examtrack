import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import {
  ChartNoAxesCombined,
  Clock3,
  Calculator,
  Download,
  FileDown,
  GraduationCap,
  LibraryBig,
  BookOpenText,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Settings2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { PageHeader } from "@/components/page-header"
import { ModeToggle } from "@/components/mode-toggle"
import {
  EMPTY_APP_DATA,
  getDueMistakes,
  recordMistakeReview,
  type ReviewResult,
  removeAttempt,
  type AppData,
  type AssessmentReference,
  type ExamAttempt,
  type Mistake,
} from "@/lib/exam-data"
import { downloadAppData, loadAppData, parseAppDataFile, saveAppData } from "@/lib/storage"
import { buildRevisionPriorities, buildRevisionQueue } from "@/lib/mistake-review"
import { downloadMistakesPdf } from "@/lib/mistake-pdf"
import { useSupabaseSync } from "@/lib/sync"
import { loadTimetable, suggestTimetableForAttempt, formatExamLabel, type Timetable } from "@/lib/timetable"
import type { ScalingReference } from "@/lib/scaling"
import { ExamTrackerPicker } from "@/components/exam-tracker-picker"
import type { ExamTimerPreset } from "@/components/exam-timer"
import type { VcaaStudyResources } from "@/lib/vcaa-resources"

const ExamSheet = lazy(() =>
  import("@/components/exam-sheet").then((module) => ({ default: module.ExamSheet })),
)
const MistakeSheet = lazy(() =>
  import("@/components/mistake-sheet").then((module) => ({ default: module.MistakeSheet })),
)
const MarkdownPreview = lazy(() =>
  import("@/components/markdown-preview").then((module) => ({ default: module.MarkdownPreview })),
)
const Dashboard = lazy(() =>
  import("@/components/dashboard").then((module) => ({ default: module.Dashboard })),
)
const VcaaExplorer = lazy(() =>
  import("@/components/vcaa-explorer").then((module) => ({ default: module.VcaaExplorer })),
)
const ExamTimer = lazy(() =>
  import("@/components/exam-timer").then((module) => ({ default: module.ExamTimer })),
)
const SettingsPage = lazy(() =>
  import("@/components/settings-page").then((module) => ({ default: module.SettingsPage })),
)
const StudyScorePredictor = lazy(() =>
  import("@/components/study-score-predictor").then((module) => ({ default: module.StudyScorePredictor })),
)
const MistakeInsights = lazy(() =>
  import("@/components/mistake-insights").then((module) => ({ default: module.MistakeInsights })),
)
const ExamLibrary = lazy(() =>
  import("@/components/exam-library").then((module) => ({ default: module.ExamLibrary })),
)

type View = "dashboard" | "library" | "timer" | "mistakes" | "predictor" | "vcaa" | "settings"

const NAVIGATION = [
  { id: "dashboard" as const, label: "Dashboard", icon: ChartNoAxesCombined },
  { id: "library" as const, label: "Exam library", icon: BookOpenText },
  { id: "timer" as const, label: "Exam timer", icon: Clock3 },
  { id: "mistakes" as const, label: "Mistakes", icon: NotebookPen },
  { id: "predictor" as const, label: "Study score", icon: Calculator },
  { id: "vcaa" as const, label: "VCAA data", icon: LibraryBig },
]
const SETTINGS_ITEM = { id: "settings" as const, label: "Settings", icon: Settings2 }

function AppSidebar({ view, data, syncLabel, onViewChange }: { view: View; data: AppData; syncLabel: string; onViewChange: (view: View) => void }) {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2 px-2">
          <GraduationCap className="size-5 shrink-0" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">ExamTrack</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Study</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={view === item.id}
                    tooltip={item.label}
                    onClick={() => {
                      onViewChange(item.id)
                      setOpenMobile(false)
                    }}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.id === "mistakes" ? <SidebarMenuBadge>{data.mistakes.filter((mistake) => !mistake.resolved).length}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={view === SETTINGS_ITEM.id}
              tooltip={SETTINGS_ITEM.label}
              onClick={() => {
                onViewChange(SETTINGS_ITEM.id)
                setOpenMobile(false)
              }}
            >
              <SETTINGS_ITEM.icon />
              <span>{SETTINGS_ITEM.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <span className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{syncLabel}</span>
      </SidebarFooter>
    </Sidebar>
  )
}

function MistakeList({ mistakes, attempts, mastered, onEdit, onReview, onDelete }: { mistakes: Mistake[]; attempts: ExamAttempt[]; mastered?: boolean; onEdit: (mistake: Mistake) => void; onReview: (mistake: Mistake, result: ReviewResult) => void; onDelete: (mistake: Mistake) => void }) {
  const attemptMap = useMemo(() => new Map(attempts.map((attempt) => [attempt.id, attempt])), [attempts])
  if (!mistakes.length) return <Empty className="min-h-64 border"><EmptyHeader><EmptyMedia variant="icon"><NotebookPen /></EmptyMedia><EmptyTitle>{mastered ? "No mastered mistakes yet" : "Revision queue clear"}</EmptyTitle><EmptyDescription>{mastered ? "Mistakes you can now answer correctly will appear here." : "Log a mistake after your next practice exam or revise a mastered one again."}</EmptyDescription></EmptyHeader></Empty>
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {mistakes.map((mistake) => {
        const attempt = attemptMap.get(mistake.attemptId)
        return (
          <Card key={mistake.id} className="min-w-0">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle>{mistake.question}</CardTitle><CardDescription>{attempt ? `${attempt.title} · ${attempt.paper}` : "Deleted exam"}</CardDescription></div>
                <div className="flex flex-wrap justify-end gap-1.5"><Badge variant={mistake.resolved ? "secondary" : "outline"}>{mistake.category}</Badge>{mistake.areaOfStudy ? <Badge variant="outline">{mistake.areaOfStudy}</Badge> : null}</div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                {mistake.questionText ? <div><p className="mb-2 text-sm font-medium">Question</p><MarkdownPreview>{mistake.questionText}</MarkdownPreview></div> : null}
                {mistake.totalMarks !== undefined && mistake.marksLost !== undefined ? <p className="text-sm text-muted-foreground">{mistake.marksLost}/{mistake.totalMarks} marks lost</p> : null}
                <p className="text-xs text-muted-foreground">{mistake.reviewHistory?.length ?? 0} review{mistake.reviewHistory?.length === 1 ? "" : "s"}{mistake.dueAt ? ` · next review ${new Date(mistake.dueAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : mistake.resolved ? " · mastered" : " · due now"}{mistake.criterion ? <> · <MarkdownPreview inline>{mistake.criterion}</MarkdownPreview></> : null}</p>
                <details className="group rounded-lg border">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">Reveal diagnosis and corrected method</summary>
                  <div className="grid gap-4 border-t p-3">
                    <div><p className="mb-2 text-sm font-medium">What went wrong</p><MarkdownPreview>{mistake.explanation}</MarkdownPreview></div>
                    <div><p className="mb-2 text-sm font-medium">Corrected method</p><MarkdownPreview>{mistake.correction}</MarkdownPreview></div>
                  </div>
                </details>
              </Suspense>
              <div className="flex flex-wrap gap-2">
                {!mastered ? <>
                  <Button size="sm" variant="outline" onClick={() => onReview(mistake, "incorrect")}>Still incorrect</Button>
                  <Button size="sm" variant="outline" onClick={() => onReview(mistake, "assisted")}>Needed help</Button>
                  <Button size="sm" onClick={() => onReview(mistake, "correct")}>Correct unaided</Button>
                </> : null}
                <Button size="sm" variant="outline" onClick={() => onEdit(mistake)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(mistake)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function MistakesPage({ data, onLog, onEdit, onReview, onDelete, onSaveInsights }: { data: AppData; onLog: () => void; onEdit: (mistake: Mistake) => void; onReview: (mistake: Mistake, result: ReviewResult) => void; onDelete: (mistake: Mistake) => void; onSaveInsights: (insights: NonNullable<AppData["mistakeInsights"]>) => void }) {
  const [subject, setSubject] = useState("all")
  const [exporting, setExporting] = useState(false)
  const attemptSubjects = useMemo(() => new Map(data.attempts.map((attempt) => [attempt.id, attempt.subject])), [data.attempts])
  const subjects = useMemo(() => [...new Set(data.attempts.map((attempt) => attempt.subject))].toSorted(), [data.attempts])
  const activeSubject = subject === "all" || subjects.includes(subject) ? subject : "all"
  const visibleMistakes = data.mistakes.filter((mistake) => activeSubject === "all" || attemptSubjects.get(mistake.attemptId) === activeSubject)
  const due = getDueMistakes(visibleMistakes)
  const unresolved = buildRevisionQueue(visibleMistakes)
  const resolved = visibleMistakes.filter((mistake) => mistake.resolved).toSorted((first, second) => second.updatedAt.localeCompare(first.updatedAt))
  const topPriority = buildRevisionPriorities(visibleMistakes).find((item) => item.unresolved > 0)
  const completion = visibleMistakes.length ? (resolved.length / visibleMistakes.length) * 100 : 0
  async function exportWorksheet() {
    setExporting(true)
    try {
      await downloadMistakesPdf(unresolved, data.attempts, activeSubject === "all" ? "mistakes" : activeSubject)
      toast.success("Worksheet downloaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export worksheet.")
    } finally {
      setExporting(false)
    }
  }
  return (
    <div className="grid gap-6">
      <PageHeader title="Mistakes" description="Redo each question before revealing the correction, then mark it mastered only when you can solve it unaided.">
        <Button variant="outline" onClick={() => void exportWorksheet()} disabled={!unresolved.length || exporting}><FileDown />{exporting ? "Creating PDF..." : "Export worksheet"}</Button>
        <Button onClick={onLog} disabled={!data.attempts.length}><Plus />Log mistake</Button>
      </PageHeader>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}><MistakeInsights data={data} onSave={onSaveInsights} /></Suspense>
      {data.mistakes.length ? (
        <div className="flex flex-wrap items-center gap-3">
          <Progress value={completion} className="w-48" />
          <span className="text-sm text-muted-foreground">{resolved.length} of {visibleMistakes.length} mastered</span>
          {subjects.length > 1 ? (
            <Select value={activeSubject} onValueChange={(value) => setSubject(value ?? "all")}>
              <SelectTrigger aria-label="Filter mistakes by subject"><SelectValue>{activeSubject === "all" ? "All subjects" : activeSubject}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}
      {topPriority ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">Start with {topPriority.category}.</span>{" "}
          <span className="text-muted-foreground">It is your most frequent unresolved error type; older mistakes in that category are first.</span>
        </div>
      ) : null}
      <Tabs defaultValue="unresolved">
        <TabsList><TabsTrigger value="unresolved">To review ({unresolved.length})</TabsTrigger><TabsTrigger value="resolved">Mastered ({resolved.length})</TabsTrigger></TabsList>
        <TabsContent value="unresolved" className="mt-4">
          {due.length !== unresolved.length ? <p className="mb-3 text-sm text-muted-foreground">{due.length} due now · {unresolved.length - due.length} scheduled for later</p> : null}
          <MistakeList mistakes={[...due, ...unresolved.filter((item) => !due.some((dueItem) => dueItem.id === item.id))]} attempts={data.attempts} onEdit={onEdit} onReview={onReview} onDelete={onDelete} />
        </TabsContent>
        <TabsContent value="resolved" className="mt-4"><MistakeList mistakes={resolved} attempts={data.attempts} mastered onEdit={onEdit} onReview={onReview} onDelete={onDelete} /></TabsContent>
      </Tabs>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>("dashboard")
  const [data, setData] = useState<AppData>(() => (typeof localStorage === "undefined" ? EMPTY_APP_DATA : loadAppData()))
  const [references, setReferences] = useState<AssessmentReference[]>([])
  const [referencesGeneratedAt, setReferencesGeneratedAt] = useState<string | null>(null)
  const [resourceStudies, setResourceStudies] = useState<VcaaStudyResources[]>([])
  const [resourcesGeneratedAt, setResourcesGeneratedAt] = useState<string | null>(null)
  const [timerPreset, setTimerPreset] = useState<ExamTimerPreset | null>(null)
  const [scalingReferences, setScalingReferences] = useState<ScalingReference[]>([])
  const [comparisonYear, setComparisonYear] = useState(2025)
  const [examOpen, setExamOpen] = useState(false)
  const [editingAttempt, setEditingAttempt] = useState<ExamAttempt | null>(null)
  const [mistakeOpen, setMistakeOpen] = useState(false)
  const [mistakeAttemptId, setMistakeAttemptId] = useState<string | null>(null)
  const [editingMistake, setEditingMistake] = useState<Mistake | null>(null)
  const [timetable, setTimetable] = useState<Timetable | null>(null)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const sync = useSupabaseSync(data, setData)

  const subjectExamIds = useMemo(() => {
    if (!timetable) return []
    const ids = new Set<string>()
    for (const attempt of data.attempts) {
      for (const entry of suggestTimetableForAttempt(attempt, timetable, data.trackedExamIds)) {
        ids.add(entry.id)
      }
    }
    return [...ids]
  }, [data.attempts, data.trackedExamIds, timetable])

  useEffect(() => saveAppData(data), [data])
  useEffect(() => {
    fetch("/vcaa-grade-distributions.json")
      .then((response) => {
        if (!response.ok) throw new Error("Reference data request failed")
        return response.json() as Promise<{ generatedAt?: string; assessments?: AssessmentReference[] }>
      })
      .then((result) => {
        setReferences(Array.isArray(result.assessments) ? result.assessments : [])
        setReferencesGeneratedAt(typeof result.generatedAt === "string" ? result.generatedAt : null)
      })
      .catch(() => setReferences([]))
  }, [])
  useEffect(() => {
    fetch("/vcaa-exam-resources.json")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Resource request failed")))
      .then((result: { generatedAt?: string; studies?: VcaaStudyResources[] }) => {
        setResourceStudies(Array.isArray(result.studies) ? result.studies : [])
        setResourcesGeneratedAt(typeof result.generatedAt === "string" ? result.generatedAt : null)
      })
      .catch(() => setResourceStudies([]))
  }, [])
  useEffect(() => {
    fetch("/vtac-scaling-reports.json")
      .then((response) => {
        if (!response.ok) throw new Error("Scaling reference data request failed")
        return response.json() as Promise<{ references?: ScalingReference[] }>
      })
      .then((result) => setScalingReferences(Array.isArray(result.references) ? result.references : []))
      .catch(() => setScalingReferences([]))
  }, [])
  useEffect(() => {
    let cancelled = false
    loadTimetable().then((result) => {
      if (!cancelled) setTimetable(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function saveAttempt(attempt: ExamAttempt, logMistake = false) {
    const isNew = !editingAttempt
    setData((current) => ({
      ...current,
      attempts: isNew
        ? [...current.attempts, attempt]
        : current.attempts.map((item) => item.id === attempt.id ? attempt : item),
    }))
    if (logMistake) {
      setEditingMistake(null)
      setMistakeAttemptId(attempt.id)
      setMistakeOpen(true)
    }

    if (!isNew) {
      toast.success("Exam updated")
      return
    }

    // After saving a practice attempt, surface official exams for that subject.
    const suggested = timetable
      ? suggestTimetableForAttempt(attempt, timetable, data.trackedExamIds)
      : []
    if (suggested.length === 0) {
      toast.success("Exam saved")
      return
    }

    const description =
      suggested.length === 1
        ? `Also track the official ${formatExamLabel(suggested[0])}?`
        : `Also track ${suggested.length} ${attempt.subject} official exams?`
    toast.success("Exam saved", {
      description,
      action: {
        label: suggested.length === 1 ? "Track" : `Track ${suggested.length}`,
        onClick: () => {
          for (const entry of suggested) toggleTrackedExam(entry.id)
        },
      },
    })
  }

  function saveSubjects(subjects: string[]) {
    setData((current) => ({ ...current, subjects, subjectsUpdatedAt: new Date().toISOString() }))
  }

  function toggleCompletedExam(id: string) {
    setData((current) => ({
      ...current,
      completedExamIds: current.completedExamIds.includes(id)
        ? current.completedExamIds.filter((examId) => examId !== id)
        : [...current.completedExamIds, id],
      completedExamIdsUpdatedAt: new Date().toISOString(),
    }))
  }

  function saveMistake(mistake: Mistake) {
    setData((current) => ({
      ...current,
      mistakes: editingMistake
        ? current.mistakes.map((item) => item.id === mistake.id ? mistake : item)
        : [...current.mistakes, mistake],
    }))
    toast.success(editingMistake ? "Mistake updated" : "Mistake saved")
  }

  function saveTimedAttempt(attempt: ExamAttempt) {
    setData((current) => ({ ...current, attempts: [...current.attempts, attempt] }))
    setView("dashboard")
    toast.success("Timed exam logged")
  }

  function logMistakeForLatest() {
    const latest = [...data.attempts].toSorted((first, second) =>
      second.completedAt.localeCompare(first.completedAt),
    )[0]
    if (!latest) return
    setEditingMistake(null)
    setMistakeAttemptId(latest.id)
    setMistakeOpen(true)
  }

  function deleteAttempt(attempt: ExamAttempt) {
    const related = data.mistakes.filter((mistake) => mistake.attemptId === attempt.id)
    setData((current) => removeAttempt(current, attempt.id))
    toast("Exam deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          const updatedAt = new Date().toISOString()
          setData((current) => ({
            ...current,
            attempts: [...current.attempts, { ...attempt, updatedAt }],
            mistakes: [...current.mistakes, ...related.map((mistake) => ({ ...mistake, updatedAt }))],
          }))
        },
      },
    })
  }

  function reviewMistake(mistake: Mistake, result: ReviewResult) {
    setData((current) => ({
      ...current,
      mistakes: current.mistakes.map((item) => item.id === mistake.id ? recordMistakeReview(item, result) : item),
    }))
    toast.success(result === "correct" ? "Review recorded" : "Added back to your revision schedule")
  }

  function deleteMistake(mistake: Mistake) {
    setData((current) => ({ ...current, mistakes: current.mistakes.filter((item) => item.id !== mistake.id) }))
    toast("Mistake deleted", { action: { label: "Undo", onClick: () => setData((current) => ({ ...current, mistakes: [...current.mistakes, { ...mistake, updatedAt: new Date().toISOString() }] })) } })
  }

  function toggleTrackedExam(id: string) {
    setData((current) => {
      const has = current.trackedExamIds.includes(id)
      return {
        ...current,
        trackedExamIds: has
          ? current.trackedExamIds.filter((value) => value !== id)
          : [...current.trackedExamIds, id],
        trackedExamIdsUpdatedAt: new Date().toISOString(),
      }
    })
  }

  function clearTrackedExams() {
    setData((current) => ({ ...current, trackedExamIds: [], trackedExamIdsUpdatedAt: new Date().toISOString() }))
  }

  function trackExamSubjects() {
    setData((current) => ({
      ...current,
      trackedExamIds: [...new Set([...current.trackedExamIds, ...subjectExamIds])],
      trackedExamIdsUpdatedAt: new Date().toISOString(),
    }))
    toast.success(`${subjectExamIds.length} exam${subjectExamIds.length === 1 ? "" : "s"} added`)
  }

  async function importData(file: File) {
    try {
      const imported = parseAppDataFile(await file.text())
      if (!window.confirm(`Replace current data with ${imported.attempts.length} exams and ${imported.mistakes.length} mistakes?`)) return
      setData(imported)
      toast.success("ExamTrack data imported")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import this file.")
    }
  }

  return (
    <SidebarProvider>
      <a href="#main-content" className="fixed left-2 top-2 z-50 -translate-y-20 rounded-md bg-background px-3 py-2 text-sm shadow focus:translate-y-0">Skip to content</a>
      <AppSidebar view={view} data={data} syncLabel={sync.user ? "Synced with Supabase" : "Stored on this device"} onViewChange={setView} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <SidebarTrigger />
          <span className="text-sm font-medium">{[...NAVIGATION, SETTINGS_ITEM].find((item) => item.id === view)?.label}</span>
          <div className="ml-auto flex gap-1">
            <ModeToggle />
            <input ref={importInput} className="sr-only" type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importData(file); event.currentTarget.value = "" }} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal /><span className="sr-only">Data actions</span></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadAppData(data)}><Download />Export data</DropdownMenuItem>
                <DropdownMenuItem onClick={() => importInput.current?.click()}><Upload />Import data</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main-content" className="w-full min-w-0 p-4 md:p-6 lg:p-8">
          {view === "dashboard" ? (
            <Suspense fallback={<div className="h-96" />}>
              <Dashboard
                data={data}
                references={references}
                comparisonYear={comparisonYear}
                onComparisonYearChange={setComparisonYear}
                timetable={timetable}
                onLogExam={() => {
                  setEditingAttempt(null)
                  setExamOpen(true)
                }}
                onLogMistakeForLatest={logMistakeForLatest}
                onOpenMistakes={() => setView("mistakes")}
                onOpenLibrary={() => setView("library")}
                onOpenTracker={() => setTrackerOpen(true)}
                onEditExam={(attempt) => { setEditingAttempt(attempt); setExamOpen(true) }}
                onAddMistake={(id) => { setEditingMistake(null); setMistakeAttemptId(id); setMistakeOpen(true) }}
                onDeleteExam={deleteAttempt}
              />
            </Suspense>
          ) : null}
          {view === "mistakes" ? <MistakesPage data={data} onLog={() => { setEditingMistake(null); setMistakeAttemptId(null); setMistakeOpen(true) }} onEdit={(mistake) => { setEditingMistake(mistake); setMistakeOpen(true) }} onReview={reviewMistake} onDelete={deleteMistake} onSaveInsights={(mistakeInsights) => setData((current) => ({ ...current, mistakeInsights }))} /> : null}
          {view === "library" ? <Suspense fallback={<Skeleton className="h-96 w-full" />}><ExamLibrary references={references} studies={resourceStudies} attempts={data.attempts} completedExamIds={data.completedExamIds} generatedAt={resourcesGeneratedAt ?? referencesGeneratedAt} preferredSubjects={data.subjects} onToggleCompleted={toggleCompletedExam} onStart={(preset) => { setTimerPreset(preset); setView("timer") }} /></Suspense> : null}
          {view === "timer" ? <Suspense fallback={<Skeleton className="h-96 w-full" />}><ExamTimer key={timerPreset ? `${timerPreset.subject}-${timerPreset.examYear}-${timerPreset.paper}` : "manual"} references={references} preferredSubjects={data.subjects} initialExam={timerPreset} onSave={(attempt) => { setTimerPreset(null); saveTimedAttempt(attempt) }} /></Suspense> : null}
          {view === "predictor" ? <Suspense fallback={<Skeleton className="h-96 w-full" />}><StudyScorePredictor data={data} references={references} scalingReferences={scalingReferences} /></Suspense> : null}
          {view === "vcaa" ? <Suspense fallback={<Skeleton className="h-96 w-full" />}><VcaaExplorer references={references} attempts={data.attempts} preferredSubjects={data.subjects} /></Suspense> : null}
          {view === "settings" ? <Suspense fallback={<Skeleton className="h-96 w-full" />}><SettingsPage sync={sync} subjects={[...new Set(references.map((reference) => reference.studyName))]} selectedSubjects={data.subjects} onSubjectsChange={saveSubjects} /></Suspense> : null}
        </main>
      </SidebarInset>
      {examOpen ? (
        <Suspense fallback={null}>
          <ExamSheet open references={references} preferredSubjects={data.subjects} comparisonYear={comparisonYear} initialAttempt={editingAttempt} onOpenChange={setExamOpen} onSave={saveAttempt} />
        </Suspense>
      ) : null}
      {mistakeOpen ? (
        <Suspense fallback={null}>
          <MistakeSheet open attempts={data.attempts} studies={resourceStudies} initialAttemptId={mistakeAttemptId} initialMistake={editingMistake} onOpenChange={setMistakeOpen} onSave={saveMistake} />
        </Suspense>
      ) : null}
      {timetable ? (
        <ExamTrackerPicker
          open={trackerOpen}
          onOpenChange={setTrackerOpen}
          entries={timetable.exams}
          trackedIds={data.trackedExamIds}
          onToggle={toggleTrackedExam}
          onClearAll={clearTrackedExams}
          onTrackSubjects={trackExamSubjects}
          subjectMatchCount={subjectExamIds.length}
          trackedCount={data.trackedExamIds.length}
        />
      ) : null}
      <Toaster position="bottom-right" />
    </SidebarProvider>
  )
}
