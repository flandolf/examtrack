import { createChatGPTProxyProvider } from "@opencoredev/loginwithchatgpt-ai"
import { jsonSchema, Output, streamText } from "ai"
import { MISTAKE_CATEGORIES, type ExamAttempt, type Mistake, type MistakeCategory, type MistakeInsights } from "@/lib/exam-data"
import { loadAISettings } from "@/lib/ai-settings"

const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export type MistakeDraft = {
  attemptId: string
  question: string
  questionText: string
  category: MistakeCategory
  explanation: string
  correction: string
}

export function validateMistakeImage(file: Pick<File, "size" | "type">): string | null {
  if (!file.type.startsWith("image/")) return "Choose an image file."
  if (file.size > MAX_IMAGE_BYTES) return "Choose an image smaller than 3 MB."
  return null
}

export function selectChatGPTModel(models: string[], preferredModel = "auto"): string | null {
  if (preferredModel !== "auto" && models.includes(preferredModel)) return preferredModel
  return models[0] ?? null
}

async function getChatGPTModel() {
  const chatgpt = createChatGPTProxyProvider()
  let models: string[]
  try {
    models = await chatgpt.listModels()
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 401) {
      throw new Error("Connect ChatGPT in Settings first.")
    }
    throw error
  }
  const settings = loadAISettings()
  const model = selectChatGPTModel(models, settings.model)
  if (!model) throw new Error("This ChatGPT account has no available model.")
  return { chatgpt, model, settings }
}

function mistakeContext(mistakes: Mistake[], attempts: ExamAttempt[]) {
  const attemptMap = new Map(attempts.map((attempt) => [attempt.id, attempt]))
  return mistakes.map((mistake) => ({
    subject: attemptMap.get(mistake.attemptId)?.subject,
    exam: attemptMap.get(mistake.attemptId)?.title,
    question: mistake.question,
    questionText: mistake.questionText,
    category: mistake.category,
    explanation: mistake.explanation,
    correction: mistake.correction,
    areaOfStudy: mistake.areaOfStudy,
    criterion: mistake.criterion,
    marksLost: mistake.marksLost,
    totalMarks: mistake.totalMarks,
    resolved: mistake.resolved,
    reviews: mistake.reviewHistory?.map(({ result }) => result),
  }))
}

export async function analyseMistakes(mistakes: Mistake[], attempts: ExamAttempt[]): Promise<MistakeInsights> {
  if (!mistakes.length) throw new Error("Log at least one mistake before generating insights.")
  const { chatgpt, model, settings } = await getChatGPTModel()
  const schema = jsonSchema<Omit<MistakeInsights, "generatedAt" | "practiceQuestions" | "questionsGeneratedAt">>({
    type: "object",
    additionalProperties: false,
    required: ["summary", "biggestErrors", "otherInsights", "nextStep"],
    properties: {
      summary: { type: "string" },
      biggestErrors: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "evidence", "action"],
          properties: {
            title: { type: "string" },
            evidence: { type: "string" },
            action: { type: "string" },
          },
        },
      },
      otherInsights: { type: "array", maxItems: 3, items: { type: "string" } },
      nextStep: { type: "string" },
    },
  })
  const result = streamText({
    model: chatgpt(model),
    output: Output.object({ schema, name: "mistake_insights" }),
    maxOutputTokens: 900,
    headers: { "x-login-with-chatgpt-reasoning-effort": settings.reasoningEffort },
    prompt: `Analyse this student's logged mistakes. Identify the most important recurring knowledge or process gaps, cite concise evidence from the records, notice useful patterns such as subjects, marks, resolution or review history, and give one practical next step. Do not claim a pattern unless the records support it. Use concise student-friendly plain text. Records: ${JSON.stringify(mistakeContext(mistakes, attempts))}`,
  })
  return { ...await result.output, generatedAt: new Date().toISOString() }
}

export async function generateMistakePracticeQuestions(insights: MistakeInsights, mistakes: Mistake[], attempts: ExamAttempt[]) {
  const { chatgpt, model, settings } = await getChatGPTModel()
  const schema = jsonSchema<{ practiceQuestions: string }>({
    type: "object",
    additionalProperties: false,
    required: ["practiceQuestions"],
    properties: {
      practiceQuestions: { type: "string", description: "A Markdown worksheet with 4-6 original questions using LaTeX for mathematical notation, followed by a separate answer section" },
    },
  })
  const { practiceQuestions: _oldQuestions, questionsGeneratedAt: _oldQuestionsGeneratedAt, ...diagnosis } = insights
  const result = streamText({
    model: chatgpt(model),
    output: Output.object({ schema, name: "practice_questions" }),
    maxOutputTokens: 1400,
    headers: { "x-login-with-chatgpt-reasoning-effort": settings.reasoningEffort },
    prompt: `Create 4-6 original practice questions that directly target these diagnosed gaps. Use Markdown with valid LaTeX ($...$ and $$...$$), do not copy the logged questions, order from easier to harder, include marks, then put worked answers in a separate section. Insights: ${JSON.stringify(diagnosis)}. Records: ${JSON.stringify(mistakeContext(mistakes, attempts))}`,
  })
  return (await result.output).practiceQuestions.trim()
}

export async function analyseMistakeImage(
  file: File,
  attempts: ExamAttempt[],
  selectedAttemptId: string,
): Promise<MistakeDraft> {
  const validationError = validateMistakeImage(file)
  if (validationError) throw new Error(validationError)

  const { chatgpt, model, settings } = await getChatGPTModel()

  const mistakeSchema = jsonSchema<MistakeDraft>({
    type: "object",
    additionalProperties: false,
    required: ["attemptId", "question", "questionText", "category", "explanation", "correction"],
    properties: {
      attemptId: { type: "string", enum: ["", ...attempts.map((attempt) => attempt.id)] },
      question: { type: "string", description: "Short question identifier, such as Question 4b" },
      questionText: { type: "string", description: "The complete exam question, in Markdown with LaTeX where useful" },
      category: { type: "string", enum: [...MISTAKE_CATEGORIES] },
      explanation: { type: "string", description: "What the student did wrong, in concise Markdown with LaTeX where useful" },
      correction: { type: "string", description: "The correct method, in concise Markdown with LaTeX where useful" },
    },
  })
  const examOptions = attempts.map(({ id, subject, provider, title, examYear, paper }) => ({
    id, subject, provider, title, examYear, paper,
  }))

  const result = streamText({
    model: chatgpt(model),
    output: Output.object({ schema: mistakeSchema, name: "mistake_log" }),
    maxOutputTokens: 700,
    headers: { "x-login-with-chatgpt-reasoning-effort": settings.reasoningEffort },
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Read the exam question and the student's working in this image. Identify the student's actual mistake and fill every field for a study mistake log. Match attemptId to one of these logged exams when the image or existing selection supports it: ${JSON.stringify(examOptions)}. The existing selection is ${JSON.stringify(selectedAttemptId)}. Use an empty attemptId if neither is reliable. Use an exact category from the schema. Keep the explanation diagnostic and the correction actionable. Preserve mathematical notation as Markdown LaTeX. If the question number is unreadable, use 'Question unclear' rather than inventing one.`,
        },
        { type: "image", image: await file.arrayBuffer(), mediaType: file.type },
      ],
    }],
  })

  const draft = await result.output
  if (!draft.question.trim() || !draft.questionText.trim() || !draft.explanation.trim() || !draft.correction.trim()) {
    throw new Error("ChatGPT could not read enough of the image to fill the mistake.")
  }
  return {
    ...draft,
    question: draft.question.trim(),
    questionText: draft.questionText.trim(),
    explanation: draft.explanation.trim(),
    correction: draft.correction.trim(),
  }
}
