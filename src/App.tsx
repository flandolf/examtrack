import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import {
  ChartNoAxesCombined,
  Clock3,
  Calculator,
  Download,
  GraduationCap,
  LibraryBig,
  BookOpenText,
  MoreHorizontal,
  NotebookPen,
  Settings2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Toaster } from "@/components/ui/sonner"
import { ModeToggle } from "@/components/mode-toggle"
import {
  EMPTY_APP_DATA,
  getDueMistakes,
  recordMistakeReview,
  type ReviewRating,
  removeAttempt,
  type AppData,
  type AssessmentReference,
  type ExamAttempt,
  type Mistake,
} from "@/lib/exam-data"
import { downloadAppData, loadAppData, parseAppDataFile, saveAppData } from "@/lib/storage"
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
const ExamLibrary = lazy(() =>
  import("@/components/exam-library").then((module) => ({ default: module.ExamLibrary })),
)
const MistakesPage = lazy(() =>
  import("@/components/mistakes-page").then((module) => ({ default: module.MistakesPage })),
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
                  {item.id === "mistakes" ? <SidebarMenuBadge>{getDueMistakes(data.mistakes).length}</SidebarMenuBadge> : null}
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

  function reviewMistake(mistake: Mistake, rating: ReviewRating) {
    setData((current) => ({
      ...current,
      mistakes: current.mistakes.map((item) => item.id === mistake.id ? recordMistakeReview(item, rating) : item),
    }))
    toast.success(`${rating[0].toUpperCase()}${rating.slice(1)} recorded`)
  }

  function toggleMistakeSuspension(mistake: Mistake) {
    const timestamp = new Date().toISOString()
    setData((current) => ({
      ...current,
      mistakes: current.mistakes.map((item) => item.id === mistake.id ? { ...item, suspended: !item.suspended, updatedAt: timestamp } : item),
    }))
    toast.success(mistake.suspended ? "Card returned to the review queue" : "Card suspended")
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
          {view === "mistakes" ? <Suspense fallback={<Skeleton className="h-96 w-full" />}><MistakesPage data={data} studies={resourceStudies} onLog={() => { setEditingMistake(null); setMistakeAttemptId(null); setMistakeOpen(true) }} onEdit={(mistake) => { setEditingMistake(mistake); setMistakeOpen(true) }} onReview={reviewMistake} onToggleSuspend={toggleMistakeSuspension} onDelete={deleteMistake} onSaveInsights={(mistakeInsights) => setData((current) => ({ ...current, mistakeInsights }))} /></Suspense> : null}
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
