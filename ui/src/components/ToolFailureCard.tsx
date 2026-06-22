import type { NormalizedPart } from '../types'

export const ToolFailureCard = ({ part }: { part: NormalizedPart }) => (
  <section className="bg-error-container/10 p-3 rounded border border-error/30">
    <div className="font-[Geist] text-[10px] font-semibold tracking-wider text-error mb-2 uppercase">
      Tool failure{part.toolName ? `: ${part.toolName}` : ''}
    </div>
    <div className="font-mono text-[13px] text-on-error-container whitespace-pre-wrap break-words">
      {part.error ?? part.text}
    </div>
  </section>
)
