'use client'
import { X, Reply } from 'lucide-react'

interface ReplyBarProps {
  replyTo: { id: string; content: string; username: string } | null
  onCancel: () => void
}

export default function ReplyBar({ replyTo, onCancel }: ReplyBarProps) {
  if (!replyTo) return null
  return (
    <div className="px-5 pt-2 flex-shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: 'rgba(192,68,255,0.08)', border: '1px solid rgba(192,68,255,0.2)' }}>
        <Reply size={13} strokeWidth={2} style={{ color: '#c044ff', flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold" style={{ color: '#c044ff' }}>@{replyTo.username} </span>
          <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{replyTo.content?.slice(0, 60)}{(replyTo.content?.length ?? 0) > 60 ? '...' : ''}</span>
        </div>
        <button onClick={onCancel} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
