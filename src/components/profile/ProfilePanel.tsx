'use client'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

export default function ProfilePanel() {
  const { activeConversation } = useChatStore()
  const other = activeConversation?.other_user
  if (!other) return null

  const initials = other.username.slice(0, 2).toUpperCase()
  const gradients = [
    'linear-gradient(135deg,#ff6b9d,#c044ff)',
    'linear-gradient(135deg,#00d4ff,#0080ff)',
    'linear-gradient(135deg,#ffb347,#ff6b9d)',
    'linear-gradient(135deg,#3dff9a,#00d4ff)',
  ]
  const gradIdx = other.username.charCodeAt(0) % gradients.length

  const lastSeen = other.status !== 'online' && other.updated_at
    ? formatDistanceToNow(new Date(other.updated_at), { addSuffix: true, locale: tr })
    : null

  const statusColor = other.status === 'online' ? '#3dff9a' : other.status === 'dnd' ? '#ff6b9d' : '#555'
  const statusLabel = other.status === 'online' ? 'Çevrimiçi'
    : other.status === 'dnd' ? 'Rahatsız Etme'
    : other.status === 'idle' ? 'Uzakta'
    : lastSeen ? `Son görülme ${lastSeen}` : 'Çevrimdışı'

  return (
    <div
      className="flex-shrink-0 flex flex-col overflow-y-auto overflow-x-hidden"
      style={{ width: 260, minWidth: 260, maxWidth: 260, background: '#10101c', borderLeft: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Banner */}
      <div className="w-full flex-shrink-0 overflow-hidden" style={{ height: 110 }}>
        {other.banner_url ? (
          <img src={other.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(192,68,255,0.2), rgba(0,212,255,0.12))' }} />
        )}
      </div>

      {/* Avatar */}
      <div className="px-4 flex-shrink-0" style={{ marginTop: -32 }}>
        <div
          className="flex items-center justify-center font-bold text-xl text-white overflow-hidden"
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: other.avatar_url ? 'transparent' : gradients[gradIdx],
            border: '4px solid #10101c',
            flexShrink: 0,
          }}
        >
          {other.avatar_url
            ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials}
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pb-4 flex flex-col gap-3 mt-2">
        <div>
          <p className="font-syne font-bold text-base truncate" style={{ color: '#f0eeff' }}>{other.username}</p>
          <p className="text-xs flex items-center gap-1 mt-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{statusLabel}</span>
          </p>
        </div>

        {other.custom_status && (
          <p className="text-xs px-3 py-2 rounded-xl truncate"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {other.custom_status}
          </p>
        )}

        {other.bio && (
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1.5"
              style={{ color: 'rgba(255,255,255,0.25)' }}>Hakkında</p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{other.bio}</p>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1.5"
            style={{ color: 'rgba(255,255,255,0.25)' }}>Mesaj İzni</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {other.allow_messages_from === 'everyone' ? 'Herkes mesaj atabilir' : 'Sadece arkadaşlar'}
          </p>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        <div className="flex flex-col gap-2">
          <button className="py-2 rounded-xl text-xs font-medium transition-all duration-150"
            style={{ background: 'rgba(192,68,255,0.1)', border: '1px solid rgba(192,68,255,0.2)', color: '#c044ff' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.18)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.1)'}>
            Arkadaşlıktan Çıkar
          </button>
          <button className="py-2 rounded-xl text-xs font-medium transition-all duration-150"
            style={{ background: 'rgba(255,107,157,0.08)', border: '1px solid rgba(255,107,157,0.15)', color: '#ff6b9d' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,157,0.15)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,157,0.08)'}>
            Engelle
          </button>
        </div>
      </div>
    </div>
  )
}
