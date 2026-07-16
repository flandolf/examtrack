import { describe, expect, test } from "bun:test"
import { selectChatGPTModel, validateMistakeImage } from "../src/lib/mistake-ai"

describe("mistake image analysis", () => {
  test("validates uploads and chooses from the account's available models", () => {
    expect(validateMistakeImage({ type: "application/pdf", size: 100 })).toBe("Choose an image file.")
    expect(validateMistakeImage({ type: "image/jpeg", size: 4 * 1024 * 1024 })).toBe("Choose an image smaller than 3 MB.")
    expect(validateMistakeImage({ type: "image/jpeg", size: 100 })).toBeNull()
    expect(selectChatGPTModel(["gpt-5.6-sol", "gpt-5.5"])).toBe("gpt-5.6-sol")
    expect(selectChatGPTModel(["gpt-5.4-mini", "gpt-5.5"], "gpt-5.4-mini")).toBe("gpt-5.4-mini")
    expect(selectChatGPTModel(["account-specific-model"])).toBe("account-specific-model")
    expect(selectChatGPTModel([])).toBeNull()
  })
})
