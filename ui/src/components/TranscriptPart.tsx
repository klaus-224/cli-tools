import type { NormalizedPart } from '../types'

type Props = {
  part: NormalizedPart
}

export const TranscriptPart = ({ part }: Props) => {
  if (part.type === 'text') {
    return <p className="text-base leading-relaxed whitespace-pre-wrap break-words">{part.text}</p>
  }

  if (part.type === 'reasoning') {
    return (
      <section className="bg-surface-container-lowest p-3 rounded border border-outline-variant/50">
        <div className="font-[Geist] text-[10px] font-semibold tracking-wider text-primary/70 mb-2 uppercase">Reasoning</div>
        <pre className="font-mono text-[13px] text-on-surface-variant whitespace-pre-wrap break-words">{part.text}</pre>
      </section>
    )
  }

  if (part.type.includes('tool') && !part.error) {
    return (
      <section className="bg-surface-container-lowest p-3 rounded border border-outline-variant">
        <div className="font-[Geist] text-[10px] font-semibold tracking-wider text-secondary mb-2 uppercase">
          Tool call{part.toolName ? `: ${part.toolName}` : ''}
        </div>
        <div className="font-mono text-[13px] text-secondary overflow-x-auto">
          <code>{JSON.stringify({ arguments: part.arguments, status: part.status }, null, 2)}</code>
        </div>
      </section>
    )
  }

  if (part.type.includes('failure') || part.error) {
    return (
      <section className="bg-error-container/10 p-3 rounded border border-error/30">
        <div className="font-[Geist] text-[10px] font-semibold tracking-wider text-error mb-2 uppercase">
          Tool failure{part.toolName ? `: ${part.toolName}` : ''}
        </div>
        <div className="font-mono text-[13px] text-on-error-container whitespace-pre-wrap break-words">
          {part.error ?? part.text}
        </div>
      </section>
    )
  }

  return (
    <details className="bg-surface-container-lowest p-3 rounded border border-outline-variant">
      <summary className="font-mono text-[13px] text-outline cursor-pointer">Unknown part type: {part.type}</summary>
      <pre className="font-mono text-[11px] text-on-surface-variant mt-2 whitespace-pre-wrap">{JSON.stringify(part.raw, null, 2)}</pre>
    </details>
  )
}
