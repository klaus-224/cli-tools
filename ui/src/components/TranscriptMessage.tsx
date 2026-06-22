import type { NormalizedMessage } from '../types'
import { formatTimestamp } from '../lib/formatters'
import { TranscriptPart } from './TranscriptPart'

type Props = {
  message: NormalizedMessage
}

export const TranscriptMessage = ({ message }: Props) => (
  <article className={`message message--${message.senderType}`}>
    <div className="message__header">
      <span>{message.role}</span>
      <span>{formatTimestamp(message.timeCreated)}</span>
    </div>
    <div className="message__body">
      {message.parts.length === 0 ? <div className="empty-state">No renderable parts.</div> : message.parts.map((part, index) => <TranscriptPart key={`${message.messageId}-${index}`} part={part} />)}
      {message.parseError && <div className="message__parse-error">Parse error: {message.parseError}</div>}
    </div>
  </article>
)
