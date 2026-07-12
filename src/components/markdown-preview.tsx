import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"

export function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className="typeset typeset-mistake rounded-lg border p-3">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}>
        {children || "Preview appears here."}
      </ReactMarkdown>
    </div>
  )
}
