'use client'
import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import type { AppView } from './AppShell'
import { useFriendRequests } from '@/hooks/useFriends'

interface SidebarProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
  dnd: boolean
  micMuted: boolean
  onToggleDnd: () => void
  onToggleMic: () => void
}

const navItems = [
  { id: 'messages' as AppView, icon: '💬', label: 'Mesajlar' },
  { id: 'friends' as AppView, icon: '👥', label: 'Arkadaşlar' },
  { id: 'calls' as AppView, icon: '📞', label: 'Aramalar' },
]

export default function Sidebar({ activeView, onViewChange, dnd, micMuted, onToggleDnd, onToggleMic }: SidebarProps) {
  const { profile, signOut } = useAuthStore()
  const { pendingCount } = useFriendRequests()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const initials = (profile?.username ?? '?').slice(0, 2).toUpperCase()

  const handleToggleDnd = async () => {
    onToggleDnd()
    const newStatus = !dnd ? 'dnd' : 'online'
    await supabase.from('profiles').update({ status: newStatus }).eq('id', profile!.id)
  }

  return (
    <div
      className="flex flex-col items-center py-4 gap-2 flex-shrink-0 relative"
      style={{ width: 72, background: '#080810', borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Logo */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #c044ff, #ff6b9d)' }}
      >
        <span className="font-syne font-black text-base text-white">A</span>
      </div>

      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

      {/* Nav */}
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onViewChange(item.id)}
          title={item.label}
          className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
          style={{
            background: activeView === item.id ? 'rgba(192,68,255,0.15)' : 'transparent',
            border: activeView === item.id ? '1px solid rgba(192,68,255,0.25)' : '1px solid transparent',
            fontSize: 18,
          }}
          onMouseEnter={(e) => { if (activeView !== item.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { if (activeView !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          {item.icon}
          {item.id === 'friends' && pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: '#ff6b9d', border: '2px solid #080810' }} />
          )}
        </button>
      ))}

      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

      <button onClick={() => onViewChange('settings')} title="Ayarlar"
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
        style={{ background: activeView === 'settings' ? 'rgba(192,68,255,0.15)' : 'transparent', fontSize: 18 }}>
        ⚙️
      </button>

      {/* Bottom user bar */}
      <div className="mt-auto flex flex-col items-center gap-2 w-full px-2">
        <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)' }} />

        {/* DND toggle */}
        <button
          onClick={handleToggleDnd}
          title={dnd ? 'Rahatsız Etme Modu Açık' : 'Rahatsız Etme Modu'}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{
            background: dnd ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${dnd ? 'rgba(255,107,157,0.3)' : 'rgba(255,255,255,0.07)'}`,
            fontSize: 16,
          }}
        >
          {dnd ? '🔕' : '🔔'}
        </button>

        {/* Mic mute toggle */}
        <button
          onClick={onToggleMic}
          title={micMuted ? 'Mikrofon Kapalı' : 'Mikrofonu Kapat'}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{
            background: micMuted ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${micMuted ? 'rgba(255,107,157,0.3)' : 'rgba(255,255,255,0.07)'}`,
            fontSize: 16,
          }}
        >
          {micMuted ? '🔇' : '🎤'}
        </button>

        {/* Avatar + profile menu */}
        <div className="relative">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white cursor-pointer flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #c044ff)', border: '2px solid rgba(192,68,255,0.4)' }}
            onClick={() => setShowProfileMenu(p => !p)}
            title="Profil"
          >
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{ background: dnd ? '#ff6b9d' : '#3dff9a', border: '2px solid #080810' }} />

          {/* Profile popup menu */}
          {showProfileMenu && (
            <div
              className="absolute bottom-12 left-0 rounded-xl overflow-hidden z-50"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', width: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-semibold" style={{ color: '#e8e6f0' }}>{profile?.username}</p>
                <p className="text-xs" style={{ color: dnd ? '#ff6b9d' : '#3dff9a' }}>
                  {dnd ? '● Rahatsız Etme' : '● Çevrimiçi'}
                </p>
              </div>
              <button
                onClick={() => { onViewChange('settings'); setShowProfileMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs transition-all duration-150"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                ⚙️ Profil Ayarları
              </button>
              <button
                onClick={() => { signOut(); setShowProfileMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs transition-all duration-150"
                style={{ color: '#ff6b9d' }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,157,0.08)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                🚪 Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
