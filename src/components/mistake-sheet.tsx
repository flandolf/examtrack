import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { MarkdownPreview } from "@/components/markdown-preview"
import {
  MISTAKE_CATEGORIES,
  type ExamAttempt,
  type Mistake,
  type MistakeCategory,
} from "@/lib/exam-data"

type MistakeSheetProps = {
  open: boolean
  attempts: ExamAttempt[]
  initialAttemptId?: string | null
  initialMistake?: Mistake | null
  onOpenChange: (open: boolean) => void
  onSave: (mistake: Mistake) => void
}

export function MistakeSheet({
  open,
  attempts,
  initialAttemptId,
  initialMistake,
  onOpenChange,
  onSave,
}: MistakeSheetProps) {
  const [attemptId, setAttemptId] = useState(initialMistake?.attemptId ?? initialAttemptId ?? "")
  const [question, setQuestion] = useState(initialMistake?.question ?? "")
  const [category, setCategory] = useState<MistakeCategory>(initialMistake?.category ?? "Concept")
  const [explanation, setExplanation] = useState(initialMistake?.explanation ?? "")
  const [correction, setCorrection] = useState(initialMistake?.correction ?? "")
  const [error, setError] = useState<string | null>(null)

  const selectedAttempt = attemptId || initialAttemptId || ""
  const attemptOptions = attempts.map((attempt) => ({
    value: attempt.id,
    label: `${attempt.title} · ${attempt.paper}`,
  }))
  const selectedAttemptOption = attemptOptions.find((attempt) => attempt.value === selectedAttempt) ?? null

  function reset() {
    setAttemptId("")
    setQuestion("")
    setCategory("Concept")
    setExplanation("")
    setCorrection("")
    setError(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedAttempt || !question.trim() || !explanation.trim() || !correction.trim()) {
      setError("Exam, question, mistake, and corrected method are required.")
      return
    }
    const timestamp = new Date().toISOString()
    onSave({
      id: initialMistake?.id ?? crypto.randomUUID(),
      attemptId: selectedAttempt,
      question: question.trim(),
      category,
      explanation: explanation.trim(),
      correction: correction.trim(),
      resolved: initialMistake?.resolved ?? false,
      createdAt: initialMistake?.createdAt ?? timestamp,
      updatedAt: timestamp,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent resizable className="w-full">
        <SheetHeader>
          <SheetTitle>{initialMistake ? "Edit mistake" : "Log mistake"}</SheetTitle>
          <SheetDescription>
            Use Markdown with $inline$ or $$block$$ LaTeX for mathematical working.
          </SheetDescription>
        </SheetHeader>
        <form id="mistake-form" className="px-4 pb-4" onSubmit={submit}>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mistake-exam">Exam</FieldLabel>
                <Combobox items={attemptOptions} value={selectedAttemptOption} onValueChange={(value) => setAttemptId(value?.value ?? "")} autoHighlight>
                  <ComboboxInput id="mistake-exam" className="w-full" placeholder="Search practice exams" />
                  <ComboboxContent>
                    <ComboboxEmpty>No matching practice exams.</ComboboxEmpty>
                    <ComboboxList>{(item) => <ComboboxItem key={item.value} value={item}>{item.label}</ComboboxItem>}</ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
              <Field>
                <FieldLabel htmlFor="question">Question</FieldLabel>
                <Input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Question 4b" />
              </Field>
            </div>

            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select value={category} onValueChange={(value) => setCategory(value as MistakeCategory)}>
                <SelectTrigger className="w-full"><SelectValue>{category}</SelectValue></SelectTrigger>
                <SelectContent>
                  {MISTAKE_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="explanation">What went wrong?</FieldLabel>
              <Textarea id="explanation" rows={5} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="I differentiated $e^{2x}$ as $e^{2x}$ and missed the chain rule." />
              <FieldDescription>Describe the error precisely enough to recognise it next time.</FieldDescription>
              <MarkdownPreview>{explanation}</MarkdownPreview>
            </Field>

            <Field>
              <FieldLabel htmlFor="correction">Corrected method</FieldLabel>
              <Textarea id="correction" rows={5} value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder="Use $\frac{d}{dx}e^{u}=u'e^u$, so the derivative is $2e^{2x}$." />
              <MarkdownPreview>{correction}</MarkdownPreview>
            </Field>
            <FieldError>{error}</FieldError>
          </FieldGroup>
        </form>
        <SheetFooter>
          <Button type="submit" form="mistake-form" disabled={attempts.length === 0}>{initialMistake ? "Save changes" : "Save mistake"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
