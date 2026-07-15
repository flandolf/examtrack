import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { QuestionConfidence, QuestionResult } from "@/lib/exam-data"

export function QuestionResultsEditor({ value, onChange }: { value: QuestionResult[]; onChange: (value: QuestionResult[]) => void }) {
  function update(id: string, patch: Partial<QuestionResult>) {
    onChange(value.map((result) => result.id === id ? { ...result, ...patch } : result))
  }

  function add() {
    onChange([...value, { id: crypto.randomUUID(), label: `Question ${value.length + 1}`, marksAwarded: 0, maxMarks: 1, confidence: "medium" }])
  }

  return (
    <Field>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <FieldLabel>Question-level marking</FieldLabel>
          <FieldDescription>Optional. Add outcomes, rubric criteria and examiner feedback to reveal coverage gaps.</FieldDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={add}><Plus />Add question</Button>
      </div>
      {value.length ? (
        <div className="divide-y rounded-lg border">
          {value.map((result) => (
            <div key={result.id} className="grid gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(8rem,1fr)_6rem_6rem_9rem_auto]">
                <label className="grid gap-1 text-xs text-muted-foreground"><span>Question</span><Input aria-label="Question label" value={result.label} onChange={(event) => update(result.id, { label: event.target.value })} placeholder="Question 4b" /></label>
                <label className="grid gap-1 text-xs text-muted-foreground"><span>Earned</span><Input aria-label={`${result.label} marks awarded`} type="number" min="0" step="0.5" value={result.marksAwarded} onChange={(event) => update(result.id, { marksAwarded: event.target.valueAsNumber })} /></label>
                <label className="grid gap-1 text-xs text-muted-foreground"><span>Out of</span><Input aria-label={`${result.label} maximum marks`} type="number" min="0.5" step="0.5" value={result.maxMarks} onChange={(event) => update(result.id, { maxMarks: event.target.valueAsNumber })} /></label>
                <label className="grid gap-1 text-xs text-muted-foreground"><span>Confidence</span><Select value={result.confidence} onValueChange={(confidence) => update(result.id, { confidence: confidence as QuestionConfidence })}>
                  <SelectTrigger aria-label={`${result.label} confidence`} className="w-full"><SelectValue>{result.confidence[0].toUpperCase() + result.confidence.slice(1)}</SelectValue></SelectTrigger>
                  <SelectContent>{(["low", "medium", "high"] as const).map((confidence) => <SelectItem key={confidence} value={confidence}>{confidence[0].toUpperCase() + confidence.slice(1)}</SelectItem>)}</SelectContent>
                </Select></label>
                <Button className="self-end" type="button" size="icon" variant="ghost" aria-label={`Remove ${result.label}`} onClick={() => onChange(value.filter((item) => item.id !== result.id))}><Trash2 /></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input aria-label={`${result.label} area of study`} value={result.areaOfStudy ?? ""} onChange={(event) => update(result.id, { areaOfStudy: event.target.value || undefined })} placeholder="Area of Study / key knowledge" />
                <Input aria-label={`${result.label} assessment criterion`} value={result.criterion ?? ""} onChange={(event) => update(result.id, { criterion: event.target.value || undefined })} placeholder="Rubric or assessment criterion" />
              </div>
              <Textarea aria-label={`${result.label} examiner feedback`} rows={2} value={result.examinerNote ?? ""} onChange={(event) => update(result.id, { examinerNote: event.target.value || undefined })} placeholder="Relevant examiner report advice or expected quality" />
            </div>
          ))}
        </div>
      ) : null}
    </Field>
  )
}
