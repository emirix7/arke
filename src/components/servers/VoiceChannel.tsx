'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Room, RoomEvent, Track, RemoteParticipant } from 'livekit-client'
import { useAuthStore } from '@/store/auth'
import { useServerStore } from '@/store/server'
import { supabase } from '@/lib/supabase'
import type { Channel } from '@/types/server'

interface VoiceChannelProps {
  channel: Channel
  onLeave: () => void
}

export default function VoiceChannel({ channel, onLeave }: VoiceChannelProps) {
  const { profile } = useAuthStore()
  const { setVoiceMembers } = useServerStore()
  const [room] = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  }))
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [participants, setParticipants] = useState<{ id: string; username: string; avatar?: string }[]>([])
  const [duration, setDuration] = useState(0)
  const screenShareRef = useRef<HTMLVideoElement>(null)

  // Register in voice_sessions on mount, remove on unmount
  useEffect(() => {
    if (!profile) return
    joinVoiceSession()
    return () => { leaveVoiceSession() }
  }, [channel.id, profile?.id])

  const joinVoiceSession = async () => {
    await supabase.from('voice_sessions').upsert({
      channel_id: channel.id,
      user_id: profile!.id,
    }, { onConflict: 'channel_id,user_id' })
    refreshVoiceMembers()
  }

  const leaveVoiceSession = async () => {
    await supabase.from('voice_sessions')
      .delete()
      .eq('channel_id', channel.id)
      .eq('user_id', profile!.id)
    refreshVoiceMembers()
  }

  const refreshVoiceMembers = async () => {
    const { data } = await supabase.from('voice_sessions')
      .select('user_id, profile:profiles(username, avatar_url)')
      .eq('channel_id', channel.id)
    if (data) {
      setVoiceMembers(channel.id, data.map((d: any) => ({
        userId: d.user_id,
        username: d.profile?.username,
        avatar: d.profile?.avatar_url,
      })))
      setParticipants(data.map((d: any) => ({
        id: d.user_id,
        username: d.profile?.username ?? '?',
        avatar: d.profile?.avatar_url,
      })))
    }
  }

  // Realtime voice session updates
  useEffect(() => {
    const ch = supabase.channel(`voice_sessions:${channel.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_sessions', filter: `channel_id=eq.${channel.id}` },
        () => refreshVoiceMembers())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [channel.id])

  useEffect(() => {
    connectToRoom()
    return () => { room.disconnect() }
  }, [channel.id])

  useEffect(() => {
    if (!connected) return
    const interval = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [connected])

  const connectToRoom = async () => {
    if (!profile) return
    const roomName = `server-voice-${channel.id}`
    const res = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, identity: profile.id }),
    })
    if (!res.ok) return
    const { token } = await res.json()

    room.on(RoomEvent.Connected, () => setConnected(true))
    room.on(RoomEvent.Disconnected, () => setConnected(false))
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        if (screenShareRef.current) track.attach(screenShareRef.current)
      }
    })

    try {
      await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
      await room.localParticipant.setMicrophoneEnabled(true)
    } catch (e) { console.error(e) }
  }

  const toggleMute = async () => {
    await room.localParticipant.setMicrophoneEnabled(muted)
    setMuted(!muted)
  }

  const toggleDeafen = async () => {
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      p.audioTrackPublications.forEach(pub => {
        if (pub.track) deafened ? pub.track.attach() : pub.track.detach()
      })
    })
    setDeafened(!deafened)
  }

  const toggleScreenShare = async () => {
    if (sharing) {
      await room.localParticipant.setScreenShareEnabled(false)
      setSharing(false)
    } else {
      try {
        await room.localParticipant.setScreenShareEnabled(true, { audio: true, contentHint: 'detail' })
        setSharing(true)
      } catch (e) { console.error(e) }
    }
  }

  const handleLeave = async () => {
    await leaveVoiceSession()
    room.disconnect()
    onLeave()
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0d0d14' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ color: '#3dff9a', fontSize: 16 }}>🔊</span>
        <p className="font-syne font-semibold text-sm flex-1" style={{ color: '#f0eeff' }}>{channel.name}</p>
        <span className="text-xs" style={{ color: connected ? '#3dff9a' : 'rgba(255,255,255,0.3)' }}>
          {connected ? fmt(duration) : 'Bağlanıyor...'}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {sharing && (
          <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#000', maxHeight: '55%' }}>
            <video ref={screenShareRef} autoPlay muted className="w-full h-full object-contain" />
          </div>
        )}

        {/* Participants grid */}
        <div className="flex flex-wrap justify-center gap-4">
          {participants.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className="relative">
                {connected && p.id === profile?.id && !muted && (
                  <div className="absolute -inset-1.5 rounded-full"
                    style={{ background: 'rgba(61,255,154,0.2)', animation: 'pulse-dot 2s infinite' }} />
                )}
                <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-semibold text-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)', position: 'relative' }}>
                  {p.avatar
                    ? <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                    : p.username.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.username}</span>
                {p.id === profile?.id && muted && <span style={{ fontSize: 10 }}>🔇</span>}
              </div>
            </div>
          ))}
        </div>

        {!connected && (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Bağlanıyor...</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pb-6 flex-shrink-0">
        <VoiceBtn active={muted} onClick={toggleMute} icon={muted ? '🔇' : '🎤'} label="Mikrofon" danger={muted} />
        <VoiceBtn active={deafened} onClick={toggleDeafen} icon={deafened ? '🔕' : '🔊'} label="Ses" danger={deafened} />
        <VoiceBtn active={sharing} onClick={toggleScreenShare} icon="🖥️" label="Ekran Paylaş" accent={sharing} />
        <button onClick={handleLeave}
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
          style={{ background: 'rgba(255,107,157,0.2)', border: '2px solid rgba(255,107,157,0.4)' }}>
          📵
        </button>
      </div>
    </div>
  )
}

function VoiceBtn({ active, onClick, icon, label, danger, accent }: {
  active: boolean; onClick: () => void; icon: string; label: string; danger?: boolean; accent?: boolean
}) {
  return (
    <button onClick={onClick} title={label}
      className="w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-150"
      style={{
        background: active && danger ? 'rgba(255,107,157,0.2)' : accent ? 'rgba(192,68,255,0.2)' : 'rgba(255,255,255,0.06)',
        border: `2px solid ${active && danger ? 'rgba(255,107,157,0.4)' : accent ? 'rgba(192,68,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
      }}>
      {icon}
    </button>
  )
}
