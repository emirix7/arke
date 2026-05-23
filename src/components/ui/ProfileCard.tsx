'use client'
import { useEffect, useRef } from 'react'
import { MessageSquare, UserMinus, Ban, Shield, Crown, User, UserX } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface ExtraAction {
  label: string; icon: string; onClick: () => void; danger?: boolean
}

interface ProfileCardProps {
  profile: {
    id: string; username: string; display_name?: string | null
    avatar_url?: string | null; banner_url?: string | null
    bio?: string | null; status: string; custom_status?: string | null; updated_at?: string
  }
  x: number; y: number; onClose: () => void
  onMessage?: () => void; onRemoveFriend?: () => void; onBlock?: () => void
  extraActions?: ExtraAction[]; roleBadge?: string
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Crown size={10} strokeWidth={2} />,
  mod: <Shield size={10} strokeWidth={2} />,
  user: <User size={10} strokeWidth={2} />,
}

export default function ProfileCard({ profile, x, y, onClose, onMessage, onRemoveFriend, onBlock, extraActions, roleBadge }: ProfileCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [])

  const cardW = 240
  const adjustedX = Math.min(x, window.innerWidth - cardW - 8)
  const adjustedY = Math.min(y, window.innerHeight - 380)
  const statusColor = profile.status === 'online' ? '#3dff9a' : profile.status === 'dnd' ? '#ff6b9d' : profile.status === 'idle' ? '#ffb347' : '#555'
  const statusLabel = profile.status === 'online' ? 'Çevrimiçi' : profile.status === 'dnd' ? 'Rahatsız Etme' : profile.status === 'idle' ? 'Uzakta' : 'Çevrimdışı'
  const lastSeen = profile.status !== 'online' && profile.updated_at
    ? formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true, locale: tr }) : null
  const initials = profile.username.slice(0, 2).toUpperCase()
  const grads = ['linear-gradient(135deg,#ff6b9d,#c044ff)', 'linear-gradient(135deg,#00d4ff,#0080ff)', 'linear-gradient(135deg,#ffb347,#ff6b9d)', 'linear-gradient(135deg,#3dff9a,#00d4ff)']
  const grad = grads[profile.username.charCodeAt(0) % grads.length]
  const roleLabel = roleBadge === 'admin' ? 'Admin' : roleBadge === 'mod' ? 'Mod' : null

  return (
    <div ref={ref} className="fixed z-[500] rounded-2xl overflow-hidden"
      style={{ left: adjustedX, top: adjustedY, width: cardW, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>

      <div style={{ height: 72, background: profile.banner_url ? `url(${profile.banner_url}) center/cover` : 'linear-gradient(135deg, rgba(192,68,255,0.25), rgba(0,212,255,0.15))' }} />

      <div style={{ padding: '0 12px', marginTop: -24 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: grad, border: '3px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white' }}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
      </div>

      <div style={{ padding: '6px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p className="font-syne font-bold text-sm" style={{ color: '#f0eeff' }}>{profile.username}</p>
            {roleLabel && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, background: 'rgba(192,68,255,0.15)', color: '#c044ff', padding: '1px 6px', borderRadius: 6, border: '1px solid rgba(192,68,255,0.2)' }}>
                {ROLE_ICONS[roleBadge!]} {roleLabel}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{lastSeen ? `Son görülme ${lastSeen}` : statusLabel}</span>
          </p>
        </div>
        {profile.custom_status && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '4px 8px' }}>{profile.custom_status}</p>
        )}
        {profile.bio && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>Hakkında</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{profile.bio}</p>
          </div>
        )}
        {(onMessage || extraActions?.length || onBlock) && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {onMessage && (
            <button onClick={() => { onMessage(); onClose() }}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'rgba(192,68,255,0.12)', border: '1px solid rgba(192,68,255,0.2)', color: '#c044ff', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={12} strokeWidth={2} /> Mesaj Gönder
            </button>
          )}
          {extraActions?.map((action, i) => {
            const iconMap: Record<string, React.ReactNode> = {
              '👑': <Crown size={12} strokeWidth={2} />,
              '🛡️': <Shield size={12} strokeWidth={2} />,
              '👤': <User size={12} strokeWidth={2} />,
              '🚫': <UserX size={12} strokeWidth={2} />,
            }
            return (
              <button key={i} onClick={() => { action.onClick(); onClose() }}
                style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: action.danger ? 'rgba(255,107,157,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${action.danger ? 'rgba(255,107,157,0.2)' : 'rgba(255,255,255,0.07)'}`, color: action.danger ? '#ff6b9d' : 'rgba(255,255,255,0.6)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                {iconMap[action.icon] || null} {action.label}
              </button>
            )
          })}
          {onBlock && (
            <button onClick={() => { onBlock(); onClose() }}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'transparent', border: '1px solid rgba(255,107,157,0.15)', color: '#ff6b9d', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ban size={12} strokeWidth={2} /> Engelle
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
