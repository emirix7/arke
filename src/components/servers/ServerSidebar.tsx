'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useServerStore } from '@/store/server'
import { useNotifications } from '@/hooks/useNotifications'
import { Plus, Link, LogOut, BellOff, Bell, MoreVertical } from 'lucide-react'
import type { Server } from '@/types/server'

interface ServerSidebarProps {
  onSelect: (server: Server) => void
  activeServerId?: string
}

export default function ServerSidebar({ onSelect, activeServerId }: ServerSidebarProps) {
  const { profile } = useAuthStore()
  const { servers, setServers } = useServerStore()
  const { serverCounts, markRead } = useNotifications()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ server: Server; x: number; y: number } | null>(null)
  const [mutedServers, setMutedServers] = useState<Set<string>>(new Set())

  useEffect(() => { if (profile) fetchServers() }, [profile?.id])

  const fetchServers = async () => {
    const { data } = await supabase.from('server_members').select('server:servers(*)').eq('user_id', profile!.id)
    if (data) setServers(data.map((d: any) => d.server).filter(Boolean))
  }

  const leaveServer = async (serverId: string) => {
    if (!profile) return
    await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', profile.id)
    fetchServers()
    setContextMenu(null)
  }

  const toggleMuteServer = (serverId: string) => {
    setMutedServers(prev => {
      const next = new Set(prev)
      next.has(serverId) ? next.delete(serverId) : next.add(serverId)
      return next
    })
    setContextMenu(null)
  }

  return (
    <div className="flex flex-col items-center gap-2 py-3 overflow-y-auto"
      style={{ width: 64, background: '#060610', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

      {servers.map(server => (
        <ServerIcon key={server.id} server={server}
          active={activeServerId === server.id}
          unreadCount={serverCounts[server.id] || 0}
          onClick={() => { onSelect(server); markRead(server.id) }}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ server, x: e.clientX, y: e.clientY }) }} />
      ))}

      {servers.length > 0 && <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />}

      <button onClick={() => setShowCreate(true)}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{ background: 'rgba(61,255,154,0.08)', border: '1px solid rgba(61,255,154,0.2)', color: '#3dff9a' }}
        title="Sunucu Oluştur"
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(61,255,154,0.15)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(61,255,154,0.08)'}>
        <Plus size={18} strokeWidth={2} />
      </button>

      <button onClick={() => setShowJoin(true)}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{ background: 'rgba(192,68,255,0.08)', border: '1px solid rgba(192,68,255,0.2)', color: '#c044ff' }}
        title="Sunucuya Katıl"
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.15)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.08)'}>
        <Link size={16} strokeWidth={2} />
      </button>

      {showCreate && <CreateServerModal onClose={() => { setShowCreate(false); fetchServers() }} />}
      {showJoin && <JoinServerModal onClose={() => { setShowJoin(false); fetchServers() }} onJoin={onSelect} />}

      {contextMenu && (
        <div className="fixed z-[500] py-1.5 rounded-xl overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 180 }}
          onClick={e => e.stopPropagation()}>
          <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{contextMenu.server.name}</p>
          </div>
          <button onClick={() => toggleMuteServer(contextMenu.server.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all"
            style={{ color: mutedServers.has(contextMenu.server.id) ? '#3dff9a' : 'rgba(255,255,255,0.7)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            {mutedServers.has(contextMenu.server.id)
              ? <><Bell size={14} strokeWidth={1.75} /> Susturmayı Kaldır</>
              : <><BellOff size={14} strokeWidth={1.75} /> Sunucuyu Sustur</>}
          </button>
          <button onClick={() => leaveServer(contextMenu.server.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all"
            style={{ color: '#ff6b9d' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,157,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <LogOut size={14} strokeWidth={1.75} /> Sunucudan Ayrıl
          </button>
        </div>
      )}

      {contextMenu && (
        <div className="fixed inset-0 z-[499]" onClick={() => setContextMenu(null)} />
      )}
    </div>
  )
}

function ServerIcon({ server, active, unreadCount, onClick, onContextMenu }: {
  server: Server; active: boolean; unreadCount: number; onClick: () => void; onContextMenu?: (e: React.MouseEvent) => void
}) {
  const initials = server.name.slice(0, 2).toUpperCase()
  const leaveServer = async (serverId: string) => {
    if (!profile) return
    await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', profile.id)
    fetchServers()
    setContextMenu(null)
  }

  const toggleMuteServer = (serverId: string) => {
    setMutedServers(prev => {
      const next = new Set(prev)
      next.has(serverId) ? next.delete(serverId) : next.add(serverId)
      return next
    })
    setContextMenu(null)
  }

  return (
    <div className="relative flex-shrink-0">
      <button onClick={onClick}
        className="w-10 h-10 flex items-center justify-center font-semibold text-sm text-white overflow-hidden transition-all duration-200"
        onContextMenu={onContextMenu}
        style={{
          background: server.icon_url ? 'transparent' : 'linear-gradient(135deg, #c044ff, #00d4ff)',
          border: active ? '2px solid #c044ff' : '2px solid transparent',
          borderRadius: active ? '12px' : '50%',
        }}
        title={server.name}>
        {server.icon_url
          ? <img src={server.icon_url} alt="" className="w-full h-full object-cover" style={{ borderRadius: active ? 10 : '50%' }} />
          : initials}
      </button>
      {unreadCount > 0 && (
        <div className="absolute -bottom-1 -right-1 flex items-center justify-center font-bold rounded-full"
          style={{ minWidth: 16, height: 16, background: '#ff6b9d', color: 'white', fontSize: 9, padding: '0 3px', border: '2px solid #060610' }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}
    </div>
  )
}

function CreateServerModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuthStore()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState('')

  const handleIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setIconFile(f); setIconPreview(URL.createObjectURL(f))
  }

  const handleCreate = async () => {
    if (!name.trim() || !profile) return
    setLoading(true)
    let icon_url = ''
    if (iconFile) {
      const ext = iconFile.name.split('.').pop()
      const { data } = await supabase.storage.from('server-icons').upload(`${profile.id}/${Date.now()}.${ext}`, iconFile, { upsert: true })
      if (data) icon_url = supabase.storage.from('server-icons').getPublicUrl(data.path).data.publicUrl
    }
    const { data: server } = await (supabase.from('servers') as any).insert({ name: name.trim(), owner_id: profile.id, icon_url: icon_url || null }).select().single()
    if (server) {
      await supabase.from('server_members').insert({ server_id: server.id, user_id: profile.id, role: 'admin' })
      await supabase.from('channels').insert([
        { server_id: server.id, name: 'genel', type: 'text', position: 0 },
        { server_id: server.id, name: 'Sesli Genel', type: 'voice', position: 1 },
      ])
    }
    setLoading(false); onClose()
  }

  const leaveServer = async (serverId: string) => {
    if (!profile) return
    await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', profile.id)
    fetchServers()
    setContextMenu(null)
  }

  const toggleMuteServer = (serverId: string) => {
    setMutedServers(prev => {
      const next = new Set(prev)
      next.has(serverId) ? next.delete(serverId) : next.add(serverId)
      return next
    })
    setContextMenu(null)
  }

  return (
    <Modal title="Sunucu Oluştur" onClose={onClose}>
      <label className="flex flex-col items-center gap-2 cursor-pointer">
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: iconPreview ? 'transparent' : 'rgba(192,68,255,0.1)', border: '2px dashed rgba(192,68,255,0.3)' }}>
          {iconPreview ? <img src={iconPreview} alt="" className="w-full h-full object-cover" /> : <span style={{ fontSize: 24 }}>🖼️</span>}
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>İkon ekle (GIF/resim)</span>
        <input type="file" accept="image/*,.gif" className="hidden" onChange={handleIcon} />
      </label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Sunucu adı" maxLength={50}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
        onKeyDown={e => e.key === 'Enter' && handleCreate()} />
      <button onClick={handleCreate} disabled={!name.trim() || loading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
        {loading ? 'Oluşturuluyor...' : 'Oluştur'}
      </button>
    </Modal>
  )
}

function JoinServerModal({ onClose, onJoin }: { onClose: () => void; onJoin: (s: Server) => void }) {
  const { profile } = useAuthStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    if (!code.trim() || !profile) return
    setLoading(true); setError('')
    const { data: server } = await supabase.from('servers').select('*').eq('invite_code', code.trim().toLowerCase()).single()
    if (!server) { setError('Geçersiz davet kodu.'); setLoading(false); return }
    await supabase.from('server_members').insert({ server_id: server.id, user_id: profile.id, role: 'user' })
    setLoading(false); onJoin(server); onClose()
  }

  const leaveServer = async (serverId: string) => {
    if (!profile) return
    await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', profile.id)
    fetchServers()
    setContextMenu(null)
  }

  const toggleMuteServer = (serverId: string) => {
    setMutedServers(prev => {
      const next = new Set(prev)
      next.has(serverId) ? next.delete(serverId) : next.add(serverId)
      return next
    })
    setContextMenu(null)
  }

  return (
    <Modal title="Sunucuya Katıl" onClose={onClose}>
      <input value={code} onChange={e => setCode(e.target.value)} placeholder="Davet kodu" maxLength={20}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
        onKeyDown={e => e.key === 'Enter' && handleJoin()} />
      {error && <p className="text-xs" style={{ color: '#ff6b9d' }}>{error}</p>}
      <button onClick={handleJoin} disabled={!code.trim() || loading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
        {loading ? 'Katılınıyor...' : 'Katıl'}
      </button>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const leaveServer = async (serverId: string) => {
    if (!profile) return
    await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', profile.id)
    fetchServers()
    setContextMenu(null)
  }

  const toggleMuteServer = (serverId: string) => {
    setMutedServers(prev => {
      const next = new Set(prev)
      next.has(serverId) ? next.delete(serverId) : next.add(serverId)
      return next
    })
    setContextMenu(null)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-80 rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <p className="font-syne font-bold" style={{ color: '#f0eeff' }}>{title}</p>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
