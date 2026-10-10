'use client'

import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Model output is rendered as markdown without raw HTML (react-markdown's default).
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>,
  h1: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h4>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-xs">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-slate-300 dark:border-slate-600 pl-3 text-slate-600 dark:text-slate-400">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 dark:bg-slate-800/60">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 tabular-nums">{children}</td>
  ),
  a: ({ href, children }) => {
    // In-app links (e.g. /vault/<term_id>) navigate client-side; others open safely in a new tab.
    if (href?.startsWith('/')) {
      return (
        <Link href={href} className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
          {children}
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
        {children}
      </a>
    )
  },
}

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
