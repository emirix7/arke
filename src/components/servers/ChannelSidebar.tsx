'use client'
import { Link, Settings, Hash, Volume2, Plus, Copy, Check, Shield, Crown, User, UserX } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useServerStore } from '@/store/server'
import ProfileCard from '@/components/ui/ProfileCard'
import type { Channel } from '@/types/server'

export default function ChannelSidebar({ onChannelSelect }: { onChannelSelect?: (ch: any) => void }) {
  const { profile } = useAuthStore()
  const { activeServer, channels, setChannels, activeChannel, setActiveChannel, members, setMembers, voiceMembers, setVoiceMembers } = useServerStore()
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAddChannel, setShowAddChannel] = useState<'text' | 'voice' | null>(null)
  const [profileCard, setProfileCard] = useState<{ member: any; x: number; y: number } | null>(null)
  const [myRole, setMyRole] = useState<'admin' | 'mod' | 'user'>('user')

  useEffect(() => {
    if (!activeServer || !profile) return
    fetchChannels(); fetchMembers()
  }, [activeServer?.id])

  useEffect(() => {
    const me = members.find((m: any) => m.user_id === profile?.id)
    if (me) setMyRole((me as any).role || 'user')
    else if (activeServer?.owner_id === profile?.id) setMyRole('admin')
  }, [members, profile?.id])

  useEffect(() => {
    if (!activeServer) return
    // Initial fetch
    channels.filter(c => c.type === 'voice').forEach(vc => fetchVoiceMembers(vc.id))

    // Realtime updates for voice sessions
    const ch = supabase.channel(`sidebar_voice:${activeServer.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'voice_sessions',
      }, () => {
        channels.filter(c => c.type === 'voice').forEach(vc => fetchVoiceMembers(vc.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [channels, activeServer?.id])

  const fetchChannels = async () => {
    const { data } = await supabase.from('channels').select('*').eq('server_id', activeServer!.id).order('position')
    if (data) setChannels(data)
  }

  const fetchMembers = async () => {
    const { data } = await supabase.from('server_members')
      .select('*, profile:profiles(id, username, avatar_url, status, bio, custom_status, banner_url, updated_at)')
      .eq('server_id', activeServer!.id)
    if (data) setMembers(data as any)
  }

  const fetchVoiceMembers = async (channelId: string) => {
    const { data } = await supabase.from('voice_sessions').select('user_id, profile:profiles(username, avatar_url)').eq('channel_id', channelId)
    if (data) setVoiceMembers(channelId, data.map((d: any) => ({ userId: d.user_id, username: d.profile?.username, avatar: d.profile?.avatar_url })))
  }

  const isAdmin = myRole === 'admin'
  const isMod = myRole === 'mod' || myRole === 'admin'
  const textChannels = channels.filter(c => c.type === 'text')
  const voiceChannels = channels.filter(c => c.type === 'voice')

  const addChannel = async (name: string, type: 'text' | 'voice') => {
    if (!activeServer) return
    await supabase.from('channels').insert({ server_id: activeServer.id, name, type, position: channels.filter(c => c.type === type).length })
    fetchChannels()
  }

  const kickMember = async (userId: string) => {
    if (!activeServer) return
    await supabase.from('server_members').delete().eq('server_id', activeServer.id).eq('user_id', userId)
    fetchMembers()
  }

  const setRole = async (userId: string, role: 'admin' | 'mod' | 'user') => {
    if (!activeServer) return
    await supabase.from('server_members').update({ role }).eq('server_id', activeServer.id).eq('user_id', userId)
    fetchMembers()
  }

  const handleMemberRightClick = (e: React.MouseEvent, member: any) => {
    e.preventDefault()
    setProfileCard({ member, x: e.clientX, y: e.clientY })
  }

  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{ width: 220, background: '#10101c', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

      {/* Server header */}
      <div className="px-3 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 min-w-0">
          {activeServer?.icon_url && <img src={activeServer.icon_url} alt="" className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />}
          <p className="font-syne font-bold text-sm truncate" style={{ color: '#f0eeff' }}>{activeServer?.name}</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => setShowInvite(true)} title="Davet Linki"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ color: '#c044ff', background: 'rgba(192,68,255,0.12)', border: '1px solid rgba(192,68,255,0.25)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.12)'}>
            <Link size={13} strokeWidth={2} /> Davet
          </button>
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} title="Sunucu Ayarları"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}>
              <Settings size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Text channels */}
        <div className="mb-2">
          <div className="flex items-center justify-between px-3 py-1">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>Metin</p>
            {isMod && <button onClick={() => setShowAddChannel('text')} className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>+</button>}
          </div>
          {textChannels.map(ch => (
            <ChannelItem key={ch.id} channel={ch} active={activeChannel?.id === ch.id} onClick={() => { setActiveChannel(ch); onChannelSelect?.(ch) }} prefix="#" />
          ))}
        </div>

        {/* Voice channels */}
        <div>
          <div className="flex items-center justify-between px-3 py-1">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>Sesli</p>
            {isMod && <button onClick={() => setShowAddChannel('voice')} className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>+</button>}
          </div>
          {voiceChannels.map(ch => (
            <VoiceChannelItem key={ch.id} channel={ch} active={activeChannel?.id === ch.id}
              onClick={() => { setActiveChannel(ch); onChannelSelect?.(ch) }} voiceUsers={(voiceMembers as any)[ch.id] ?? []} />
          ))}
        </div>

        {/* Members */}
        <div className="mt-4">
          <p className="px-3 py-1 text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Üyeler — {members.length}
          </p>
          {members.map((m: any) => (
            <MemberItem key={m.id} member={m} onRightClick={(e) => handleMemberRightClick(e, m)} />
          ))}
        </div>
      </div>

      {showInvite && <InviteModal server={activeServer!} onClose={() => setShowInvite(false)} />}
      {showSettings && <ServerSettingsModal server={activeServer!} onClose={() => setShowSettings(false)} onUpdate={fetchMembers} />}
      {showAddChannel && (
        <AddChannelModal type={showAddChannel} onClose={() => setShowAddChannel(null)}
          onAdd={(name) => { addChannel(name, showAddChannel!); setShowAddChannel(null) }} />
      )}

      {profileCard && (
        <ProfileCard
          profile={profileCard.member.profile}
          x={profileCard.x} y={profileCard.y}
          onClose={() => setProfileCard(null)}
          extraActions={isMod && profileCard.member.user_id !== profile?.id ? [
            ...(isAdmin ? [
              { label: 'Mod Yap', icon: '🛡️', onClick: () => setRole(profileCard.member.user_id, 'mod') },
              { label: 'Admin Yap', icon: '👑', onClick: () => setRole(profileCard.member.user_id, 'admin') },
              { label: 'User Yap', icon: '👤', onClick: () => setRole(profileCard.member.user_id, 'user') },
            ] : []),
            { label: 'Sunucudan At', icon: '🚫', onClick: () => kickMember(profileCard.member.user_id), danger: true },
          ] : []}
          roleBadge={(profileCard.member as any).role}
        />
      )}
    </div>
  )
}

function ChannelItem({ channel, active, onClick, prefix }: { channel: Channel; active: boolean; onClick: () => void; prefix: string }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-all duration-150"
      style={{ background: active ? 'rgba(192,68,255,0.12)' : 'transparent', color: active ? '#e8e6f0' : 'rgba(255,255,255,0.45)', borderRadius: 8 }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <span style={{ fontSize: 13 }}>{prefix}</span>
      <span className="truncate">{channel.name}</span>
    </button>
  )
}

function VoiceChannelItem({ channel, active, onClick, voiceUsers }: { channel: Channel; active: boolean; onClick: () => void; voiceUsers: any[] }) {
  return (
    <div className="mb-0.5">
      <button onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-all duration-150"
        style={{ background: active ? 'rgba(61,255,154,0.1)' : 'transparent', color: active ? '#3dff9a' : 'rgba(255,255,255,0.45)', borderRadius: 8 }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <span style={{ fontSize: 13 }}>🔊</span>
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {voiceUsers.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(61,255,154,0.15)', color: '#3dff9a' }}>{voiceUsers.length}</span>
        )}
      </button>
      {voiceUsers.length > 0 && (
        <div className="ml-6 flex flex-col gap-0.5 mb-1">
          {voiceUsers.map((u: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-2 py-0.5 rounded-lg">
              <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3dff9a, #00d4ff)' }}>
                {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : (u.username ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs truncate" style={{ color: '#3dff9a' }}>{u.username}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberItem({ member, onRightClick }: { member: any; onRightClick: (e: React.MouseEvent) => void }) {
  const p = member.profile
  if (!p) return null
  const statusColor = p.status === 'online' ? '#3dff9a' : '#555'
  const roleIcon = member.role === 'admin' ? '👑' : member.role === 'mod' ? '🛡️' : ''

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg"
      onContextMenu={onRightClick}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
      <div className="relative flex-shrink-0">
        <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ background: statusColor, border: '1.5px solid #10101c' }} />
      </div>
      <span className="text-xs truncate flex-1" style={{ color: p.status === 'online' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
        {p.username}
      </span>
      {roleIcon && <span style={{ fontSize: 10 }}>{roleIcon}</span>}
    </div>
  )
}

function InviteModal({ server, onClose }: { server: any; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(server.invite_code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <Modal title="Davet Linki" onClose={onClose}>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Bu kodu arkadaşlarınla paylaş</p>
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="flex-1 font-mono text-sm font-bold" style={{ color: '#c044ff' }}>{server.invite_code}</span>
        <button onClick={copy} className="text-xs px-3 py-1 rounded-lg"
          style={{ background: copied ? 'rgba(61,255,154,0.15)' : 'rgba(192,68,255,0.15)', color: copied ? '#3dff9a' : '#c044ff' }}>
          {copied ? 'Kopyalandı!' : 'Kopyala'}
        </button>
      </div>
    </Modal>
  )
}

function ServerSettingsModal({ server, onClose, onUpdate }: { server: any; onClose: () => void; onUpdate: () => void }) {
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState(server.icon_url || '')
  const [name, setName] = useState(server.name)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<any[]>([])

  useEffect(() => {
    supabase.from('server_members')
      .select('*, profile:profiles(id, username, avatar_url)')
      .eq('server_id', server.id)
      .then(({ data }) => { if (data) setMembers(data as any) })
  }, [])

  const handleIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setIconFile(f); setIconPreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    setSaving(true)
    let icon_url = server.icon_url
    if (iconFile) {
      const ext = iconFile.name.split('.').pop()
      const { data } = await supabase.storage.from('server-icons').upload(`${server.owner_id}/${Date.now()}.${ext}`, iconFile, { upsert: true })
      if (data) icon_url = supabase.storage.from('server-icons').getPublicUrl(data.path).data.publicUrl
    }
    await (supabase.from('servers') as any).update({ name, icon_url }).eq('id', server.id)
    setSaving(false); onUpdate(); onClose()
  }

  return (
    <Modal title="Sunucu Ayarları" onClose={onClose}>
      <label className="flex flex-col items-center gap-2 cursor-pointer">
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: iconPreview ? 'transparent' : 'rgba(192,68,255,0.1)', border: '2px dashed rgba(192,68,255,0.3)' }}>
          {iconPreview ? <img src={iconPreview} alt="" className="w-full h-full object-cover" /> : <span style={{ fontSize: 24 }}>🖼️</span>}
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>İkon değiştir (GIF/resim)</span>
        <input type="file" accept="image/*,.gif" className="hidden" onChange={handleIcon} />
      </label>

      <input value={name} onChange={e => setName(e.target.value)} placeholder="Sunucu adı"
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }} />

      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Üyeler</p>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                {m.profile?.avatar_url ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" /> : m.profile?.username?.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs flex-1 truncate" style={{ color: '#e8e6f0' }}>{m.profile?.username}</span>
              <select value={m.role || 'user'}
                onChange={async (e) => {
                  await supabase.from('server_members').update({ role: e.target.value }).eq('id', m.id)
                  setMembers(prev => prev.map(x => x.id === m.id ? { ...x, role: e.target.value } : x))
                }}
                style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 11, borderRadius: 6, padding: '2px 4px' }}>
                <option value="user">User</option>
                <option value="mod">Mod</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </Modal>
  )
}

function AddChannelModal({ type, onClose, onAdd }: { type: string; onClose: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <Modal title={`${type === 'text' ? 'Metin' : 'Sesli'} Kanal Ekle`} onClose={onClose}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="kanal-adı" maxLength={30}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onAdd(name.trim()) }} />
      <button onClick={() => name.trim() && onAdd(name.trim())} disabled={!name.trim()}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>Oluştur</button>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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
