'use client'
import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import type { AppView } from './AppShell'
import { useFriendRequests } from '@/hooks/useFriends'
import { MessageSquare, Users, Phone, Settings, Bell, BellOff, Mic, MicOff, LogOut } from 'lucide-react'

interface SidebarProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
  dnd: boolean
  micMuted: boolean
  onToggleDnd: () => void
  onToggleMic: () => void
}

const navItems = [
  { id: 'messages' as AppView, icon: MessageSquare, label: 'Mesajlar' },
  { id: 'friends' as AppView, icon: Users, label: 'Arkadaşlar' },
  
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
    <div className="flex flex-col items-center py-4 gap-1.5 flex-shrink-0 relative"
      style={{ width: 72, background: '#080810', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

      {/* Logo */}
      <div className="mb-2 flex-shrink-0">
        <img src="/arke-logo.png" alt="Arke"
          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
      </div>

      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />

      {/* Nav */}
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = activeView === item.id
        return (
          <button key={item.id} onClick={() => onViewChange(item.id)} title={item.label}
            className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
            style={{
              background: isActive ? 'rgba(192,68,255,0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(192,68,255,0.25)' : '1px solid transparent',
              color: isActive ? '#c044ff' : 'rgba(255,255,255,0.4)',
            }}
            onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)' } }}
            onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)' } }}>
            <Icon size={18} strokeWidth={1.75} />
            {item.id === 'friends' && pendingCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: '#ff6b9d', border: '2px solid #080810' }} />
            )}
          </button>
        )
      })}

      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />

      <button onClick={() => onViewChange('settings')} title="Ayarlar"
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
        style={{
          background: activeView === 'settings' ? 'rgba(192,68,255,0.15)' : 'transparent',
          color: activeView === 'settings' ? '#c044ff' : 'rgba(255,255,255,0.4)',
          border: activeView === 'settings' ? '1px solid rgba(192,68,255,0.25)' : '1px solid transparent',
        }}>
        <Settings size={18} strokeWidth={1.75} />
      </button>

      {/* Bottom controls */}
      <div className="mt-auto flex flex-col items-center gap-1.5 w-full px-2">
        <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)' }} />

        {/* DND */}
        <button onClick={handleToggleDnd} title={dnd ? 'Rahatsız Etme Açık' : 'Rahatsız Etme'}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{
            background: dnd ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${dnd ? 'rgba(255,107,157,0.3)' : 'rgba(255,255,255,0.07)'}`,
            color: dnd ? '#ff6b9d' : 'rgba(255,255,255,0.35)',
          }}>
          {dnd ? <BellOff size={16} strokeWidth={1.75} /> : <Bell size={16} strokeWidth={1.75} />}
        </button>

        {/* Mic */}
        <button onClick={onToggleMic} title={micMuted ? 'Mikrofon Kapalı' : 'Mikrofonu Kapat'}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{
            background: micMuted ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${micMuted ? 'rgba(255,107,157,0.3)' : 'rgba(255,255,255,0.07)'}`,
            color: micMuted ? '#ff6b9d' : 'rgba(255,255,255,0.35)',
          }}>
          {micMuted ? <MicOff size={16} strokeWidth={1.75} /> : <Mic size={16} strokeWidth={1.75} />}
        </button>

        {/* Avatar */}
        <div className="relative">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white cursor-pointer overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #c044ff)', border: '2px solid rgba(192,68,255,0.4)' }}
            onClick={() => setShowProfileMenu(p => !p)} title="Profil">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{ background: dnd ? '#ff6b9d' : '#3dff9a', border: '2px solid #080810' }} />

          {showProfileMenu && (
            <div className="absolute bottom-12 left-0 rounded-xl overflow-hidden z-50"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', width: 168, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-semibold" style={{ color: '#e8e6f0' }}>{profile?.username}</p>
                <p className="text-xs" style={{ color: dnd ? '#ff6b9d' : '#3dff9a' }}>
                  {dnd ? '● Rahatsız Etme' : '● Çevrimiçi'}
                </p>
              </div>
              <button onClick={() => { onViewChange('settings'); setShowProfileMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-all"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <Settings size={13} strokeWidth={1.75} /> Profil Ayarları
              </button>
              <button onClick={() => { signOut(); setShowProfileMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-all"
                style={{ color: '#ff6b9d' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,157,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <LogOut size={13} strokeWidth={1.75} /> Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
