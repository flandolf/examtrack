import { createChatGPTProxyProvider } from "@opencoredev/loginwithchatgpt-ai"
import { jsonSchema, Output, streamText } from "ai"
import { MISTAKE_CATEGORIES, type ExamAttempt, type MistakeCategory } from "@/lib/exam-data"
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
  return models.find((model) => model.startsWith("gpt-5")) ?? null
}

export async function analyseMistakeImage(
  file: File,
  attempts: ExamAttempt[],
  selectedAttemptId: string,
): Promise<MistakeDraft> {
  const validationError = validateMistakeImage(file)
  if (validationError) throw new Error(validationError)

  const chatgpt = createChatGPTProxyProvider()
  let models: string[]
  try {
    models = await chatgpt.listModels()
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 401) {
      throw new Error("Connect ChatGPT before analysing the image.")
    }
    throw error
  }

  const settings = loadAISettings()
  const model = selectChatGPTModel(models, settings.model)
  if (!model) throw new Error("This ChatGPT account has no supported GPT-5 model.")

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
