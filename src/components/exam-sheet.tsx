import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatExamTitle, validateAttempt, type AssessmentReference, type ExamAttempt } from "@/lib/exam-data"

type ExamSheetProps = {
  open: boolean
  references: AssessmentReference[]
  initialAttempt?: ExamAttempt | null
  onOpenChange: (open: boolean) => void
  onSave: (attempt: ExamAttempt) => void
}

const today = new Date().toISOString().slice(0, 10)

export function ExamSheet({ open, references, initialAttempt, onOpenChange, onSave }: ExamSheetProps) {
  const [subject, setSubject] = useState(initialAttempt?.subject ?? "")
  const [provider, setProvider] = useState(initialAttempt?.provider ?? "VCAA")
  const [examYear, setExamYear] = useState(initialAttempt?.examYear ?? new Date().getFullYear())
  const [paper, setPaper] = useState(initialAttempt?.paper ?? "")
  const [completedAt, setCompletedAt] = useState(initialAttempt?.completedAt ?? today)
  const [rawScore, setRawScore] = useState(initialAttempt?.rawScore ?? 0)
  const [rawMax, setRawMax] = useState(initialAttempt?.rawMax ?? 40)
  const [error, setError] = useState<string | null>(null)

  const subjects = useMemo(
    () => [...new Set(references.map((item) => item.studyName))].toSorted(),
    [references],
  )
  function reset() {
    setSubject("")
    setProvider("VCAA")
    setExamYear(new Date().getFullYear())
    setPaper("")
    setCompletedAt(today)
    setRawScore(0)
    setRawMax(40)
    setError(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scoreError = validateAttempt({ rawScore, rawMax })
    if (!subject.trim() || !paper.trim()) {
      setError("Subject and paper are required.")
      return
    }
    if (scoreError) {
      setError(scoreError)
      return
    }

    const timestamp = new Date().toISOString()
    onSave({
      id: initialAttempt?.id ?? crypto.randomUUID(),
      subject: subject.trim(),
      provider: provider.trim() || "Other",
      title: formatExamTitle(provider, examYear, subject),
      examYear,
      paper: paper.trim(),
      completedAt,
      rawScore,
      rawMax,
      referenceId: null,
      createdAt: initialAttempt?.createdAt ?? timestamp,
      updatedAt: timestamp,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent resizable className="w-full">
        <SheetHeader>
          <SheetTitle>{initialAttempt ? "Edit practice exam" : "Log practice exam"}</SheetTitle>
          <SheetDescription>
            Record a completed practice exam and its raw mark.
          </SheetDescription>
        </SheetHeader>
        <form id="exam-form" className="px-4 pb-4" onSubmit={submit}>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="subject">Subject</FieldLabel>
                <Combobox
                  items={subjects}
                  inputValue={subject}
                  value={subjects.includes(subject) ? subject : null}
                  onInputValueChange={setSubject}
                  onValueChange={(value) => setSubject(value ?? "")}
                  autoHighlight
                >
                  <ComboboxInput id="subject" placeholder="Search VCAA subjects" showClear />
                  <ComboboxContent>
                    <ComboboxEmpty>No matching VCAA subjects.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
              <Field>
                <FieldLabel htmlFor="provider">Provider</FieldLabel>
                <Input id="provider" value={provider} onChange={(event) => setProvider(event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="exam-year">Exam year</FieldLabel>
                <Input id="exam-year" type="number" min="1990" max="2100" value={examYear} onChange={(event) => setExamYear(event.target.valueAsNumber)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="paper">Paper</FieldLabel>
                <Input id="paper" value={paper} onChange={(event) => setPaper(event.target.value)} placeholder="Exam 1" />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="completed-at">Completed</FieldLabel>
              <Input id="completed-at" type="date" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="raw-score">Mark</FieldLabel>
                <Input id="raw-score" type="number" min="0" step="0.5" value={rawScore} onChange={(event) => setRawScore(event.target.valueAsNumber)} />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="raw-max">Out of</FieldLabel>
                <Input id="raw-max" type="number" min="0.5" step="0.5" value={rawMax} onChange={(event) => setRawMax(event.target.valueAsNumber)} />
              </Field>
            </div>
            <FieldError>{error}</FieldError>
          </FieldGroup>
        </form>
        <SheetFooter>
          <Button type="submit" form="exam-form">{initialAttempt ? "Save changes" : "Save exam"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
