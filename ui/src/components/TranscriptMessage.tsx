import type { NormalizedMessage } from '../types'
import { formatTimestamp } from '../lib/formatters'
import { TranscriptPart } from './TranscriptPart'

type Props = {
  message: NormalizedMessage
}

export const TranscriptMessage = ({ message }: Props) => {
  const isUser = message.senderType === 'user'

  return (
    <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end ml-auto' : 'items-start'}`}>
      {/* Avatar and label for assistant */}
      {!isUser && (
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded bg-primary-container flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[14px] text-on-primary-container"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              smart_toy
            </span>
          </div>
          <span className="font-[Geist] text-[10px] font-semibold tracking-wider text-primary uppercase">
            {message.agent ?? message.role}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={
          isUser
            ? 'bg-primary/10 border border-primary/20 text-on-surface p-4 rounded-xl rounded-tr-none shadow-sm'
            : 'glass-panel text-on-surface p-4 rounded-xl rounded-tl-none shadow-xl border-l-2 border-l-primary'
        }
      >
        <div className="space-y-3">
          {message.parts.length === 0 ? (
            <div className="text-outline text-sm italic">No renderable parts.</div>
          ) : (
            message.parts.map((part, index) => (
              <TranscriptPart key={`${message.messageId}-${index}`} part={part} />
            ))
          )}
          {message.parseError && (
            <div className="text-error text-xs mt-2">Parse error: {message.parseError}</div>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <span className="font-[Geist] text-[10px] font-semibold tracking-wider text-outline px-2 uppercase">
        {isUser ? `User` : ''} {message.timeCreated ? formatTimestamp(message.timeCreated) : ''}
      </span>
    </div>
  )
}
