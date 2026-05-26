'use client'
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { useConversations } from '@/hooks/useConversations'
import ProfileCard from '@/components/ui/ProfileCard'
import StoriesBar from '@/components/ui/StoriesBar'
import type { ConversationWithProfile } from '@/types/database'

export default function FriendsPanel() {
  const { profile } = useAuthStore()
  const { conversations, setActiveConversation, activeConversation } = useChatStore()
  const [profileCard, setProfileCard] = useState<{ profile: any; x: number; y: number } | null>(null)
  const [search, setSearch] = useState('')
  useConversations()

  const statusColor = (status: string) => {
    switch (status) {
      case 'online': return '#3dff9a'
      case 'idle': return '#ffb347'
      case 'dnd': return '#ff6b9d'
      default: return '#555'
    }
  }

  const initials = (name: string) => name.split(/[._]/).map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    return conversations.filter(c => c.other_user.username.toLowerCase().includes(search.toLowerCase()))
  }, [conversations, search])

  const online = filtered.filter(c => c.other_user.status === 'online')
  const offline = filtered.filter(c => c.other_user.status !== 'online')

  const handleRightClick = (e: React.MouseEvent, conv: ConversationWithProfile) => {
    e.preventDefault()
    setProfileCard({ profile: conv.other_user, x: e.clientX, y: e.clientY })
  }

  return (
    <div className="flex flex-col flex-shrink-0"
      style={{ width: 240, background: '#10101c', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

      <div className="px-4 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Mesajlar</p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Search size={13} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ara..." className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }} />
        </div>
      </div>

      <StoriesBar />
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {online.length > 0 && (
          <>
            <p className="px-2 py-1 text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Çevrimiçi — {online.length}
            </p>
            {online.map(conv => (
              <ConvItem key={conv.id} conv={conv} active={activeConversation?.id === conv.id}
                onSelect={() => setActiveConversation(conv)}
                onRightClick={e => handleRightClick(e, conv)}
                statusColor={statusColor(conv.other_user.status)}
                initials={initials(conv.other_user.username)} />
            ))}
          </>
        )}
        {offline.length > 0 && (
          <>
            <p className="px-2 py-1 text-xs font-semibold tracking-widest uppercase mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Çevrimdışı — {offline.length}
            </p>
            {offline.map(conv => (
              <ConvItem key={conv.id} conv={conv} active={activeConversation?.id === conv.id}
                onSelect={() => setActiveConversation(conv)}
                onRightClick={e => handleRightClick(e, conv)}
                statusColor={statusColor(conv.other_user.status)}
                initials={initials(conv.other_user.username)} />
            ))}
          </>
        )}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {search ? 'Sonuç bulunamadı.' : 'Henüz sohbet yok.\nArkadaş ekle ve mesajlaşmaya başla!'}
            </p>
          </div>
        )}
      </div>

      {profileCard && (
        <ProfileCard profile={profileCard.profile} x={profileCard.x} y={profileCard.y}
          onClose={() => setProfileCard(null)}
          onMessage={() => {
            const conv = conversations.find(c => c.other_user.id === profileCard.profile.id)
            if (conv) setActiveConversation(conv)
          }} />
      )}
    </div>
  )
}

function ConvItem({ conv, active, onSelect, onRightClick, statusColor, initials }: {
  conv: ConversationWithProfile; active: boolean; onSelect: () => void
  onRightClick: (e: React.MouseEvent) => void; statusColor: string; initials: string
}) {
  const gradients = ['linear-gradient(135deg,#ff6b9d,#c044ff)', 'linear-gradient(135deg,#00d4ff,#0080ff)', 'linear-gradient(135deg,#ffb347,#ff6b9d)', 'linear-gradient(135deg,#3dff9a,#00d4ff)']
  const gradIdx = conv.other_user.username.charCodeAt(0) % gradients.length

  return (
    <div onClick={onSelect} onContextMenu={onRightClick}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150"
      style={{ background: active ? 'rgba(192,68,255,0.12)' : 'transparent', border: active ? '1px solid rgba(192,68,255,0.15)' : '1px solid transparent' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
          style={{ background: gradients[gradIdx] }}>
          {conv.other_user.avatar_url
            ? <img src={conv.other_user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            : initials}
        </div>
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full" style={{ background: statusColor, border: '2px solid #10101c' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#e8e6f0' }}>{conv.other_user.username}</p>
        <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {conv.other_user.custom_status || (conv.other_user.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı')}
        </p>
      </div>
      {(conv.unread_count ?? 0) > 0 && (
        <div className="text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: '#c044ff', color: 'white', minWidth: 18, textAlign: 'center' }}>
          {conv.unread_count}
        </div>
      )}
    </div>
  )
}
