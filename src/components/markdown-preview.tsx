import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"

export function MarkdownPreview({ children, inline = false }: { children: string; inline?: boolean }) {
  const markdown = children
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => `$$\n${math}\n$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => `$${math}$`)

  if (inline) {
    return (
      <span className="typeset">
        <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }} remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}>
          {markdown}
        </ReactMarkdown>
      </span>
    )
  }

  return (
    <div className="typeset typeset-mistake rounded-lg border p-3">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}>
        {markdown || "Preview appears here."}
      </ReactMarkdown>
    </div>
  )
}
