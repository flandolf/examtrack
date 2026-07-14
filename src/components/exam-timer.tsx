import { useMemo, useState, type FormEvent } from "react"
import { Check, Clock3, RotateCcw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { PageHeader } from "@/components/page-header"
import { useTickingNow } from "@/hooks/use-ticking-now"
import { formatExamTitle, validateAttempt, type AssessmentReference, type ExamAttempt } from "@/lib/exam-data"
import { formatTimer, getExamTimerState } from "@/lib/exam-timer"

type TimerSession = {
  subject: string
  provider: string
  title: string
  examYear: number
  paper: string
  readingMinutes: number
  writingMinutes: number
  marks: number
  startedAt: number
}

type ExamTimerProps = {
  references: AssessmentReference[]
  onSave: (attempt: ExamAttempt) => void
}

const STORAGE_KEY = "examtrack.timer"
const today = () => new Date().toISOString().slice(0, 10)

function loadSession(): TimerSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<TimerSession> | null
    return value && typeof value.subject === "string" && typeof value.provider === "string" &&
      typeof value.title === "string" && typeof value.examYear === "number" && typeof value.paper === "string" &&
      typeof value.startedAt === "number" && typeof value.readingMinutes === "number" &&
      typeof value.writingMinutes === "number" && typeof value.marks === "number"
      ? value as TimerSession
      : null
  } catch {
    return null
  }
}

export function ExamTimer({ references, onSave }: ExamTimerProps) {
  const [session, setSession] = useState<TimerSession | null>(loadSession)
  const [subject, setSubject] = useState("")
  const [provider, setProvider] = useState("VCAA")
  const [examYear, setExamYear] = useState(new Date().getFullYear())
  const [paper, setPaper] = useState("")
  const [readingMinutes, setReadingMinutes] = useState(15)
  const [writingMinutes, setWritingMinutes] = useState(60)
  const [marks, setMarks] = useState(40)
  const [markingOpen, setMarkingOpen] = useState(false)
  const [rawScore, setRawScore] = useState(0)
  const [rawMax, setRawMax] = useState(40)
  const [completedAt, setCompletedAt] = useState(today)
  const [markingError, setMarkingError] = useState<string | null>(null)
  const now = useTickingNow(250)

  const subjects = useMemo(() => [...new Set(references.map((item) => item.studyName))].toSorted(), [references])
  const timer = useMemo(() => session
    ? getExamTimerState(now.getTime(), session.startedAt, session.readingMinutes, session.writingMinutes, session.marks)
    : null, [now, session])

  function start(event: FormEvent) {
    event.preventDefault()
    const next = {
      subject: subject.trim(), provider: provider.trim(), title: formatExamTitle(provider, examYear, subject), examYear, paper: paper.trim(),
      readingMinutes, writingMinutes, marks, startedAt: Date.now(),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setSession(next)
    setRawMax(marks)
  }

  function reset() {
    if (timer?.phase !== "overtime" && !window.confirm("Discard this timed exam and return to setup?")) return
    sessionStorage.removeItem(STORAGE_KEY)
    setSession(null)
    setMarkingOpen(false)
  }

  function skipReading() {
    if (!session) return
    const next = { ...session, startedAt: Date.now() - session.readingMinutes * 60_000 }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setSession(next)
  }

  function openMarking() {
    if (!session) return
    setRawMax(session.marks)
    setMarkingError(null)
    setMarkingOpen(true)
  }

  function saveMark(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    const error = validateAttempt({ rawScore, rawMax })
    if (error) {
      setMarkingError(error)
      return
    }
    const timestamp = new Date().toISOString()
    onSave({
      id: crypto.randomUUID(),
      subject: session.subject,
      provider: session.provider,
      title: session.title,
      examYear: session.examYear,
      paper: session.paper,
      completedAt,
      rawScore,
      rawMax,
      referenceId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    sessionStorage.removeItem(STORAGE_KEY)
    setMarkingOpen(false)
    setSession(null)
  }

  if (!session || !timer) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Exam timer" description="Choose an exam, set the conditions, then begin when your paper is ready." />
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Set up your exam</CardTitle>
            <CardDescription>Enter the paper details and timed conditions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={start}>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="timer-subject">Subject</FieldLabel>
                    <Combobox value={subject} inputValue={subject} onValueChange={(value) => setSubject(value ?? "")} onInputValueChange={setSubject}>
                      <ComboboxInput id="timer-subject" placeholder="Search or enter a subject" showClear required />
                      <ComboboxContent>
                        <ComboboxEmpty>No subject found.</ComboboxEmpty>
                        <ComboboxList>{subjects.map((item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>)}</ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="timer-provider">Provider</FieldLabel>
                    <Input id="timer-provider" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="VCAA" required />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="timer-year">Exam year</FieldLabel>
                    <Input id="timer-year" type="number" min="1990" max="2100" value={examYear} onChange={(event) => setExamYear(event.target.valueAsNumber)} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="timer-paper">Paper</FieldLabel>
                    <Input id="timer-paper" value={paper} onChange={(event) => setPaper(event.target.value)} placeholder="Exam 1" />
                  </Field>
                </div>

                <div className="border-t pt-5">
                  <p className="mb-4 text-sm font-medium">Timed conditions</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor="reading-time">Reading (min)</FieldLabel>
                      <Input id="reading-time" type="number" min="0" max="180" value={readingMinutes} onChange={(event) => setReadingMinutes(event.target.valueAsNumber)} required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="writing-time">Writing (min)</FieldLabel>
                      <Input id="writing-time" type="number" min="1" max="360" value={writingMinutes} onChange={(event) => setWritingMinutes(event.target.valueAsNumber)} required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="exam-marks">Total marks</FieldLabel>
                      <Input id="exam-marks" type="number" min="1" max="500" value={marks} onChange={(event) => setMarks(event.target.valueAsNumber)} required />
                    </Field>
                  </div>
                </div>
                <Alert>
                  <Clock3 />
                  <AlertTitle>{(writingMinutes / marks || 0).toFixed(2)} minutes per mark</AlertTitle>
                  <AlertDescription>The timer moves from reading to writing automatically and records overtime.</AlertDescription>
                </Alert>
                <Button type="submit" size="lg">{readingMinutes ? "Begin reading time" : "Begin writing time"}</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const phaseLabel = timer.phase === "reading" ? "Reading time" : timer.phase === "writing" ? "Writing time" : "Overtime"
  const overtime = timer.phase === "overtime"
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8">
      <PageHeader title={session.title} description={`${session.subject} · ${session.readingMinutes} min reading · ${session.writingMinutes} min writing · ${session.marks} marks`}>
        <Button variant="ghost" onClick={reset}><RotateCcw />Discard</Button>
        <Button onClick={openMarking}><Check />Finish & mark</Button>
      </PageHeader>

      <section className="grid gap-6 py-6 text-center">
        <div>
          <p className={overtime ? "text-sm font-medium text-destructive" : "text-sm font-medium text-muted-foreground"}>{phaseLabel}</p>
          <p role="timer" className={overtime ? "mt-2 text-7xl font-semibold tracking-tight text-destructive tabular-nums sm:text-8xl" : "mt-2 text-7xl font-semibold tracking-tight tabular-nums sm:text-8xl"}>
            {overtime ? `+${formatTimer(timer.overtimeSeconds)}` : formatTimer(timer.remainingSeconds)}
          </p>
        </div>
        <Progress value={timer.progress} className="mx-auto w-full max-w-2xl">
          <ProgressLabel>{phaseLabel}</ProgressLabel>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">{Math.round(timer.progress)}%</span>
        </Progress>
        {timer.phase === "reading" ? <Button className="mx-auto" variant="outline" onClick={skipReading}>Skip to writing time</Button> : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader><CardDescription>Pace</CardDescription><CardTitle className="text-3xl tabular-nums">{(session.writingMinutes / session.marks).toFixed(2)} min / mark</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Expected progress</CardDescription><CardTitle className="text-3xl tabular-nums">{timer.phase === "reading" ? "Starts in writing time" : `${timer.expectedMarks.toFixed(1)} / ${session.marks} marks`}</CardTitle></CardHeader></Card>
      </div>

      {overtime ? <Alert variant="destructive"><Clock3 /><AlertTitle>Writing time has ended</AlertTitle><AlertDescription>The timer is now recording overtime. Finish and mark when you put your pen down.</AlertDescription></Alert> : null}

      <Dialog open={markingOpen} onOpenChange={setMarkingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark and log exam</DialogTitle>
            <DialogDescription>Enter your result to add this timed attempt to ExamTrack.</DialogDescription>
          </DialogHeader>
          <form id="timer-marking-form" onSubmit={saveMark}>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={markingError ? true : undefined}>
                  <FieldLabel htmlFor="timer-score">Mark</FieldLabel>
                  <Input id="timer-score" type="number" min="0" step="0.5" value={rawScore} onChange={(event) => setRawScore(event.target.valueAsNumber)} autoFocus required />
                </Field>
                <Field data-invalid={markingError ? true : undefined}>
                  <FieldLabel htmlFor="timer-maximum">Out of</FieldLabel>
                  <Input id="timer-maximum" type="number" min="0.5" step="0.5" value={rawMax} onChange={(event) => setRawMax(event.target.valueAsNumber)} required />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="timer-completed">Completed</FieldLabel>
                <Input id="timer-completed" type="date" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} required />
              </Field>
              <FieldError>{markingError}</FieldError>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkingOpen(false)}>Keep timing</Button>
            <Button type="submit" form="timer-marking-form">Log exam attempt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
