import type { NormalizedPart } from '../types'

export const ToolFailureCard = ({ part }: { part: NormalizedPart }) => (
  <section className="part part--failure">
    <div className="part__label">Tool failure{part.toolName ? `: ${part.toolName}` : ''}</div>
    <div className="part__mono">{part.error ?? part.text}</div>
  </section>
)
