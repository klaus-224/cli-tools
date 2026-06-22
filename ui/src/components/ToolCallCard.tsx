import type { NormalizedPart } from '../types'

export const ToolCallCard = ({ part }: { part: NormalizedPart }) => (
  <section className="bg-surface-container-lowest p-3 rounded border border-outline-variant">
    <div className="font-[Geist] text-[10px] font-semibold tracking-wider text-secondary mb-2 uppercase">
      Tool call{part.toolName ? `: ${part.toolName}` : ''}
    </div>
    <div className="font-mono text-[13px] text-secondary overflow-x-auto">
      <code>{JSON.stringify({ arguments: part.arguments, status: part.status }, null, 2)}</code>
    </div>
  </section>
)
