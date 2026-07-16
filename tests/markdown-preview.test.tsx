import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownPreview } from "../src/components/markdown-preview"

test("renders Markdown with valid math and keeps invalid LaTeX non-fatal", () => {
  const valid = renderToStaticMarkup(<MarkdownPreview>Use $x^2$ here.</MarkdownPreview>)
  expect(valid).toContain("katex")
  expect(valid).toContain("x")

  expect(() => renderToStaticMarkup(<MarkdownPreview>{"Broken $\\notacommand{$"}</MarkdownPreview>)).not.toThrow()
})

test("renders LaTeX parenthesis and bracket delimiters", () => {
  const markup = renderToStaticMarkup(
    <MarkdownPreview>{"Inline \\(f(x)=x^{1/3}\\) and display \\[x^2+1\\]"}</MarkdownPreview>,
  )

  expect(markup).toContain("katex")
  expect(markup).toContain("katex-display")
  expect(markup).not.toContain("\\(f(x)")
  expect(markup).not.toContain("\\[x^2")
})

test("renders inline assessment criteria without the preview card", () => {
  const markup = renderToStaticMarkup(<MarkdownPreview inline>{"Use $x^2$ correctly."}</MarkdownPreview>)
  expect(markup).toContain("katex")
  expect(markup).not.toContain("rounded-lg")
})
