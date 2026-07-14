import { useState, type FormEvent } from "react"
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react"
import { CheckCircle2, Copy, ExternalLink, LogOut, Sparkles } from "lucide-react"
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
  validateMistakeMarks,
} from "@/lib/exam-data"
import { analyseMistakeImage, validateMistakeImage } from "@/lib/mistake-ai"

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
  const auth = useLoginWithChatGPT()
  const [attemptId, setAttemptId] = useState(initialMistake?.attemptId ?? initialAttemptId ?? "")
  const [question, setQuestion] = useState(initialMistake?.question ?? "")
  const [questionText, setQuestionText] = useState(initialMistake?.questionText ?? "")
  const [category, setCategory] = useState<MistakeCategory>(initialMistake?.category ?? "Concept")
  const [explanation, setExplanation] = useState(initialMistake?.explanation ?? "")
  const [correction, setCorrection] = useState(initialMistake?.correction ?? "")
  const [totalMarks, setTotalMarks] = useState(initialMistake?.totalMarks ?? 0)
  const [marksLost, setMarksLost] = useState(initialMistake?.marksLost ?? 0)
  const [image, setImage] = useState<File | null>(null)
  const [analysing, setAnalysing] = useState(false)
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
    setQuestionText("")
    setCategory("Concept")
    setExplanation("")
    setCorrection("")
    setTotalMarks(0)
    setMarksLost(0)
    setImage(null)
    setError(null)
  }

  async function analyse() {
    if (!image) return
    const validationError = validateMistakeImage(image)
    if (validationError) return setError(validationError)

    setAnalysing(true)
    setError(null)
    try {
      const draft = await analyseMistakeImage(image, attempts, selectedAttempt)
      if (draft.attemptId) setAttemptId(draft.attemptId)
      setQuestion(draft.question)
      setQuestionText(draft.questionText)
      setCategory(draft.category)
      setExplanation(draft.explanation)
      setCorrection(draft.correction)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not analyse this image.")
    } finally {
      setAnalysing(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const marksError = validateMistakeMarks(totalMarks, marksLost)
    if (!selectedAttempt || !question.trim() || !questionText.trim() || !explanation.trim() || !correction.trim()) {
      setError("Exam, question number, question, mistake, and corrected method are required.")
      return
    }
    if (marksError) return setError(marksError)
    const timestamp = new Date().toISOString()
    onSave({
      id: initialMistake?.id ?? crypto.randomUUID(),
      attemptId: selectedAttempt,
      question: question.trim(),
      questionText: questionText.trim(),
      category,
      explanation: explanation.trim(),
      correction: correction.trim(),
      totalMarks,
      marksLost,
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
            <Field>
              <FieldLabel htmlFor="mistake-image">Question and working photo</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="mistake-image"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    setImage(event.target.files?.[0] ?? null)
                    setError(null)
                  }}
                />
                <Button type="button" variant="secondary" disabled={!image || analysing || !auth.isAuthenticated} onClick={() => void analyse()}>
                  <Sparkles />{analysing ? "Analysing…" : "Fill with AI"}
                </Button>
              </div>
              <FieldDescription>Upload or take a photo up to 3 MB. Review the generated fields before saving.</FieldDescription>
              <div className="rounded-lg border bg-muted/30 p-3">
                {auth.status === "loading" ? <p className="text-sm text-muted-foreground">Checking ChatGPT connection…</p> : null}

                {auth.isAuthenticated ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span className="truncate text-sm font-medium">Connected{auth.user?.email ? ` as ${auth.user.email}` : ""}</span>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void auth.logout()}><LogOut />Disconnect</Button>
                  </div>
                ) : null}

                {auth.status === "pending" ? (
                  <div className="grid gap-3">
                    <p className="text-sm">Enter <strong className="font-mono">{auth.userCode}</strong> in the ChatGPT authorization window.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void auth.copyCode()}><Copy />{auth.copied ? "Copied" : "Copy code"}</Button>
                      <Button size="sm" variant="outline" render={<a href={auth.verificationUrl} target="_blank" rel="noopener noreferrer" />}><ExternalLink />Reopen</Button>
                    </div>
                  </div>
                ) : null}

                {auth.status !== "loading" && !auth.isAuthenticated && auth.status !== "pending" ? (
                  <div className="grid gap-3">
                    <p className="text-sm leading-5 text-muted-foreground">AI requests use your ChatGPT plan. The photo passes through this server; ExamTrack never receives your password, and disconnecting deletes the session.</p>
                    <div>
                      <Button type="button" size="sm" variant="outline" disabled={auth.isConnecting} onClick={() => void auth.login({ popup: window.open("about:blank", "_blank") })}>
                        <Sparkles />{auth.isConnecting ? "Connecting…" : "I understand, connect ChatGPT"}
                      </Button>
                    </div>
                    {auth.error ? <p role="alert" className="text-sm text-destructive">{auth.error}</p> : null}
                  </div>
                ) : null}
              </div>
            </Field>

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
                <FieldLabel htmlFor="question">Question number</FieldLabel>
                <Input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Question 4b" />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mistake-total-marks">Total marks</FieldLabel>
                <Input id="mistake-total-marks" type="number" min="0.5" step="0.5" value={totalMarks || ""} onChange={(event) => setTotalMarks(event.target.valueAsNumber)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="mistake-marks-lost">Marks lost</FieldLabel>
                <Input id="mistake-marks-lost" type="number" min="0" step="0.5" value={marksLost} onChange={(event) => setMarksLost(event.target.valueAsNumber)} required />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="question-text">Question</FieldLabel>
              <Textarea id="question-text" rows={4} value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="Enter the full question text." />
              <MarkdownPreview>{questionText}</MarkdownPreview>
            </Field>

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
