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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatExamTitle, formatReferenceName, validateAttempt, type AssessmentReference, type ExamAttempt } from "@/lib/exam-data"

type ExamSheetProps = {
  open: boolean
  references: AssessmentReference[]
  initialAttempt?: ExamAttempt | null
  onOpenChange: (open: boolean) => void
  onSave: (attempt: ExamAttempt) => void
}

const today = new Date().toISOString().slice(0, 10)

export function ExamSheet({ open, references, initialAttempt, onOpenChange, onSave }: ExamSheetProps) {
  const [referenceId, setReferenceId] = useState<string | null>(initialAttempt?.referenceId ?? null)
  const [comparisonYear, setComparisonYear] = useState<number | null>(
    references.find((item) => item.id === initialAttempt?.referenceId)?.year ?? null,
  )
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
  const subjectReferences = useMemo(
    () => references.filter((item) => item.studyName.toLowerCase() === subject.trim().toLowerCase()),
    [references, subject],
  )
  const comparisonYears = useMemo(
    () => [...new Set(subjectReferences.map((item) => item.year))].toSorted((a, b) => b - a),
    [subjectReferences],
  )
  const yearReferences = useMemo(
    () => subjectReferences.filter((item) => item.year === comparisonYear),
    [comparisonYear, subjectReferences],
  )

  const reference = useMemo(
    () => references.find((item) => item.id === referenceId),
    [referenceId, references],
  )

  function selectReference(item: AssessmentReference) {
    setReferenceId(item.id)
    setComparisonYear(item.year)
    setExamYear(item.year)
    setPaper(formatReferenceName(item.name))
    setProvider("VCAA")
  }

  function selectComparisonYear(value: string | null) {
    if (!value || value === "none") {
      setComparisonYear(null)
      setReferenceId(null)
      return
    }
    const year = Number(value)
    const matches = subjectReferences.filter((item) => item.year === year)
    setComparisonYear(year)
    setReferenceId(null)
    if (matches.length === 1) selectReference(matches[0])
  }

  function reset() {
    setReferenceId(null)
    setComparisonYear(null)
    setSubject("")
    setProvider("VCAA")
    setExamYear(new Date().getFullYear())
    setPaper("")
    setCompletedAt(today)
    setRawScore(0)
    setRawMax(40)
    setError(null)
  }

  function changeSubject(value: string) {
    setSubject(value)
    setReferenceId(null)
    setComparisonYear(null)
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
      referenceId,
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
            Link an official distribution when available, or enter any exam manually.
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
                  onInputValueChange={changeSubject}
                  onValueChange={(value) => changeSubject(value ?? "")}
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

            <Field>
              <FieldLabel>Official VCAA comparison</FieldLabel>
              <div className={yearReferences.length > 1 ? "grid gap-2 sm:grid-cols-2" : undefined}>
                <Select value={comparisonYear ? String(comparisonYear) : "none"} onValueChange={selectComparisonYear} disabled={!subjectReferences.length}>
                  <SelectTrigger className="w-full"><SelectValue>{subjectReferences.length ? (comparisonYear ? String(comparisonYear) : "No comparison") : "Select a VCAA subject first"}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No comparison</SelectItem>
                    {comparisonYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
                {yearReferences.length > 1 ? (
                  <Select value={reference?.year === comparisonYear ? reference.id : ""} onValueChange={(value) => {
                    const item = references.find((candidate) => candidate.id === value)
                    if (item) selectReference(item)
                  }}>
                    <SelectTrigger className="w-full"><SelectValue>{reference ? formatReferenceName(reference.name) : "Choose an examination"}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {yearReferences.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{formatReferenceName(item.name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
              <FieldDescription>Choose a year, then the examination only when the subject has more than one.</FieldDescription>
            </Field>

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
            {reference ? (
              <FieldDescription>
                This result will be scaled to {reference.maxScore}: {rawScore}/{rawMax} → {((rawScore / rawMax) * reference.maxScore || 0).toFixed(1)}/{reference.maxScore}.
              </FieldDescription>
            ) : null}
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
