import { useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownPreview } from "@/components/markdown-preview"
import { analyseMistakes, generateMistakePracticeQuestions } from "@/lib/mistake-ai"
import type { AppData, MistakeInsights as MistakeInsightsData } from "@/lib/exam-data"

export function MistakeInsights({ data, onSave }: { data: AppData; onSave: (insights: MistakeInsightsData) => void }) {
  const [running, setRunning] = useState(false)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const insights = data.mistakeInsights
  const stale = insights && data.mistakes.some((mistake) => mistake.updatedAt > insights.generatedAt)

  async function runAnalysis() {
    setRunning(true)
    try {
      onSave(await analyseMistakes(data.mistakes, data.attempts))
      toast.success("Mistake insights updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not analyse mistakes.")
    } finally {
      setRunning(false)
    }
  }

  async function generateQuestions() {
    if (!insights) return
    setGeneratingQuestions(true)
    try {
      const practiceQuestions = await generateMistakePracticeQuestions(insights, data.mistakes, data.attempts)
      onSave({ ...insights, practiceQuestions, questionsGeneratedAt: new Date().toISOString() })
      toast.success("Practice questions generated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate questions.")
    } finally {
      setGeneratingQuestions(false)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Mistake insights</CardTitle>
          <CardDescription>{insights ? `Last updated ${new Date(insights.generatedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}${stale ? " · Mistakes changed since then" : ""}` : "Run when you want ChatGPT to find patterns across your logged mistakes. It never runs automatically."}</CardDescription>
        </div>
        <Button variant={insights ? "outline" : "default"} onClick={() => void runAnalysis()} disabled={!data.mistakes.length || running || generatingQuestions}>
          {insights ? <RefreshCw /> : <Sparkles />}{running ? "Analysing…" : insights ? "Refresh" : "Analyse mistakes"}
        </Button>
      </CardHeader>
      {insights ? (
        <CardContent className="grid gap-5">
          <p className="text-sm text-muted-foreground">{insights.summary}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {insights.biggestErrors.map((error) => (
              <div key={error.title} className="rounded-lg border p-3">
                <p className="font-medium">{error.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{error.evidence}</p>
                <p className="mt-2 text-sm">{error.action}</p>
              </div>
            ))}
          </div>
          {insights.otherInsights.length ? <div><p className="mb-2 text-sm font-medium">Other patterns</p><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{insights.otherInsights.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          <div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="font-medium">Next step: </span>{insights.nextStep}</div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void generateQuestions()} disabled={running || generatingQuestions}>
              <Sparkles />{generatingQuestions ? "Generating…" : insights.practiceQuestions ? "Regenerate practice questions" : "Generate practice questions"}
            </Button>
            {insights.questionsGeneratedAt ? <span className="text-xs text-muted-foreground">Questions updated {new Date(insights.questionsGeneratedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</span> : null}
          </div>
          {insights.practiceQuestions ? <MarkdownPreview>{insights.practiceQuestions}</MarkdownPreview> : null}
        </CardContent>
      ) : null}
    </Card>
  )
}
