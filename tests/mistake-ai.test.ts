import { describe, expect, test } from "bun:test"
import { createChatGPTProgressHandler, selectChatGPTModel, validateMistakeImage, validateMistakeImages } from "../src/lib/mistake-ai"

describe("mistake image analysis", () => {
  test("validates uploads and chooses from the account's available models", () => {
    expect(validateMistakeImage({ type: "application/pdf", size: 100 })).toBe("Choose an image file.")
    expect(validateMistakeImage({ type: "image/jpeg", size: 4 * 1024 * 1024 })).toBe("Choose an image smaller than 3 MB.")
    expect(validateMistakeImage({ type: "image/jpeg", size: 100 })).toBeNull()
    expect(validateMistakeImages([{ type: "image/jpeg", size: 2 * 1024 * 1024 }, { type: "image/png", size: 2 * 1024 * 1024 }])).toBe("Choose images totalling less than 3 MB.")
    expect(selectChatGPTModel(["gpt-5.6-sol", "gpt-5.5"])).toBe("gpt-5.6-sol")
    expect(selectChatGPTModel(["gpt-5.4-mini", "gpt-5.5"], "gpt-5.4-mini")).toBe("gpt-5.4-mini")
    expect(selectChatGPTModel(["account-specific-model"])).toBe("account-specific-model")
    expect(selectChatGPTModel([])).toBeNull()
  })

  test("reports streamed tokens and detected reasoning", () => {
    const updates: unknown[] = []
    const onChunk = createChatGPTProgressHandler((progress) => updates.push(progress))
    onChunk({ chunk: { type: "reasoning-delta", text: "think" } })
    onChunk({ chunk: { type: "text-delta", text: "answer" } })
    onChunk({ chunk: { type: "finish", totalUsage: { outputTokens: 12, outputTokenDetails: { reasoningTokens: 4 } } } })
    expect(updates).toEqual([
      { phase: "thinking", tokens: 2, estimated: true, reasoning: true },
      { phase: "writing", tokens: 3, estimated: true, reasoning: true },
      { phase: "complete", tokens: 12, estimated: false, reasoning: true },
    ])
  })
})
