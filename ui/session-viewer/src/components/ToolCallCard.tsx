import type { NormalizedPart } from '../types'

export const ToolCallCard = ({ part }: { part: NormalizedPart }) => (
  <section className="part part--tool">
    <div className="part__label">Tool call{part.toolName ? `: ${part.toolName}` : ''}</div>
    <div className="part__mono">{JSON.stringify({ arguments: part.arguments, status: part.status }, null, 2)}</div>
  </section>
)
