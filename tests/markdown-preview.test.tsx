import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownPreview } from "../src/components/markdown-preview"

test("renders Markdown with valid math and keeps invalid LaTeX non-fatal", () => {
  const valid = renderToStaticMarkup(<MarkdownPreview>Use $x^2$ here.</MarkdownPreview>)
  expect(valid).toContain("katex")
  expect(valid).toContain("x")

  expect(() => renderToStaticMarkup(<MarkdownPreview>{"Broken $\\notacommand{$"}</MarkdownPreview>)).not.toThrow()
})
