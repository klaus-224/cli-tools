import type { NormalizedPart } from '../types'

type Props = {
  part: NormalizedPart
}

export const TranscriptPart = ({ part }: Props) => {
  if (part.type === 'text') return <pre className="part part--text">{part.text}</pre>
  if (part.type === 'reasoning') return <section className="part part--reasoning"><div className="part__label">Reasoning</div><pre>{part.text}</pre></section>
  if (part.type.includes('tool') && !part.error) return <section className="part part--tool"><div className="part__label">Tool call {part.toolName ? `: ${part.toolName}` : ''}</div><div className="part__mono">{JSON.stringify({ arguments: part.arguments, status: part.status }, null, 2)}</div></section>
  if (part.type.includes('failure') || part.error) return <section className="part part--failure"><div className="part__label">Tool failure {part.toolName ? `: ${part.toolName}` : ''}</div><div className="part__mono">{part.error ?? part.text}</div></section>
  return <details className="part part--unknown"><summary>Unknown part type: {part.type}</summary><pre>{JSON.stringify(part.raw, null, 2)}</pre></details>
}
