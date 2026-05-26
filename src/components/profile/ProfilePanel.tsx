'use client'
import { useState, useEffect } from 'react'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import ImageViewer from '@/components/ui/ImageViewer'
import { UserMinus, Ban, ShieldOff } from 'lucide-react'

export default function ProfilePanel() {
  const { activeConversation, setActiveConversation, conversations, setConversations } = useChatStore()
  const { profile } = useAuthStore()
  const [viewImage, setViewImage] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const other = activeConversation?.other_user
  if (!other) return null

  useEffect(() => {
    if (!profile || !other) return
    // Check if we blocked them (use maybeSingle instead of single to avoid 406)
    Promise.all([
      supabase.from('blocks' as any).select('id').eq('blocker_id', profile.id).eq('blocked_id', other.id).maybeSingle(),
      supabase.from('blocks' as any).select('id').eq('blocker_id', other.id).eq('blocked_id', profile.id).maybeSingle()
    ]).then(([{ data: d1 }, { data: d2 }]) => setIsBlocked(!!d1 || !!d2))
  }, [profile?.id, other?.id])

  const initials = other.username.slice(0, 2).toUpperCase()
  const gradients = [
    'linear-gradient(135deg,#ff6b9d,#c044ff)',
    'linear-gradient(135deg,#00d4ff,#0080ff)',
    'linear-gradient(135deg,#ffb347,#ff6b9d)',
    'linear-gradient(135deg,#3dff9a,#00d4ff)',
  ]
  const gradIdx = other.username.charCodeAt(0) % gradients.length
  const lastSeen = other.status !== 'online' && (other as any).updated_at
    ? formatDistanceToNow(new Date((other as any).updated_at), { addSuffix: true, locale: tr }) : null
  const statusColor = other.status === 'online' ? '#3dff9a' : other.status === 'dnd' ? '#ff6b9d' : '#555'
  const statusLabel = other.status === 'online' ? 'Çevrimiçi'
    : other.status === 'dnd' ? 'Rahatsız Etme'
    : lastSeen ? `Son görülme ${lastSeen}` : 'Çevrimdışı'

  const removeFriendship = async () => {
    if (!profile) return
    await supabase.from('friendships').delete()
      .eq('sender_id', profile.id).eq('receiver_id', other.id)
    await supabase.from('friendships').delete()
      .eq('sender_id', other.id).eq('receiver_id', profile.id)
  }

  const removeFromConversations = () => {
    // Remove from conversations list in store
    const updated = conversations.filter(c => c.id !== activeConversation?.id)
    setConversations(updated)
    setActiveConversation(null as any)
  }

  const handleRemoveFriend = async () => {
    if (!profile || removing) return
    setRemoving(true)
    await removeFriendship()
    setRemoving(false)
    removeFromConversations()
  }

  const handleToggleBlock = async () => {
    if (!profile || blocking) return
    setBlocking(true)
    if (isBlocked) {
      // Unblock
      await supabase.from('blocks' as any).delete()
        .eq('blocker_id', profile.id).eq('blocked_id', other.id)
      setIsBlocked(false)
    } else {
      // Block - also remove friendship
      await removeFriendship()
      await supabase.from('blocks' as any).insert({
        blocker_id: profile.id, blocked_id: other.id
      })
      setIsBlocked(true)
      removeFromConversations()
    }
    setBlocking(false)
  }

  return (
    <div className="flex-shrink-0 flex flex-col overflow-y-auto overflow-x-hidden"
      style={{ width: 260, minWidth: 260, background: '#10101c', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>

      {/* Banner */}
      <div className="w-full flex-shrink-0 overflow-hidden relative group"
        style={{ height: 110, cursor: (other as any).banner_url ? 'pointer' : 'default' }}
        onClick={() => (other as any).banner_url && setViewImage((other as any).banner_url)}>
        {(other as any).banner_url ? (
          <>
            <img src={(other as any).banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.3)' }}>
              <span className="text-xs text-white">Büyüt</span>
            </div>
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(192,68,255,0.2), rgba(0,212,255,0.12))' }} />
        )}
      </div>

      {/* Avatar */}
      <div className="px-4 flex-shrink-0" style={{ marginTop: -32 }}>
        <div className="relative group cursor-pointer inline-block"
          onClick={() => other.avatar_url && setViewImage(other.avatar_url)}>
          <div className="flex items-center justify-center font-bold text-xl text-white overflow-hidden"
            style={{ width: 64, height: 64, borderRadius: '50%', background: other.avatar_url ? 'transparent' : gradients[gradIdx], border: '4px solid #10101c' }}>
            {other.avatar_url
              ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          {other.avatar_url && (
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.4)' }}>
              <span style={{ fontSize: 10, color: 'white' }}>Büyüt</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3 mt-2">
        <div>
          <p className="font-syne font-bold text-base truncate" style={{ color: '#f0eeff' }}>{other.username}</p>
          <p className="text-xs flex items-center gap-1 mt-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{statusLabel}</span>
          </p>
        </div>

        {(other as any).activity && (
          <p className="text-xs px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(other as any).activity_emoji ?? '🎮'} {(other as any).activity}
          </p>
        )}

        {(other as any).custom_status && (
          <p className="text-xs px-3 py-2 rounded-xl truncate"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(other as any).custom_status}
          </p>
        )}

        {(other as any).bio && (
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Hakkında</p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{(other as any).bio}</p>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        <div className="flex flex-col gap-2">
          {!isBlocked && (
            <button onClick={handleRemoveFriend} disabled={removing}
              className="py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(192,68,255,0.1)', border: '1px solid rgba(192,68,255,0.2)', color: '#c044ff', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.18)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.1)'}>
              <UserMinus size={12} strokeWidth={2} />
              {removing ? 'Çıkarılıyor...' : 'Arkadaşlıktan Çıkar'}
            </button>
          )}
          <button onClick={handleToggleBlock} disabled={blocking}
            className="py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
            style={{
              background: isBlocked ? 'rgba(61,255,154,0.08)' : 'rgba(255,107,157,0.08)',
              border: `1px solid ${isBlocked ? 'rgba(61,255,154,0.2)' : 'rgba(255,107,157,0.15)'}`,
              color: isBlocked ? '#3dff9a' : '#ff6b9d',
              cursor: 'pointer'
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
            {isBlocked ? <><ShieldOff size={12} strokeWidth={2} /> Engeli Kaldır</> : <><Ban size={12} strokeWidth={2} /> Engelle</>}
          </button>
        </div>
      </div>

      {viewImage && <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />}
    </div>
  )
}
