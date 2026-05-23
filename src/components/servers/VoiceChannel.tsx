'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Room, RoomEvent, Track, RemoteParticipant,
  RemoteTrackPublication, LocalTrackPublication,
  createLocalAudioTrack, RoomConnectOptions
} from 'livekit-client'
import { Mic, MicOff, Volume2, VolumeX, MonitorUp, PhoneOff } from 'lucide-react'
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
  const roomRef = useRef<Room | null>(null)
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map())
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [participants, setParticipants] = useState<{ id: string; username: string; avatar?: string; speaking?: boolean }[]>([])
  const [duration, setDuration] = useState(0)
  const screenShareVideoRef = useRef<HTMLVideoElement>(null)

  const updateParticipants = useCallback(async () => {
    if (!roomRef.current || !profile) return
    const names: { id: string; username: string; avatar?: string }[] = [
      { id: profile.id, username: profile.username, avatar: profile.avatar_url ?? undefined }
    ]
    roomRef.current.remoteParticipants.forEach((p) => {
      names.push({ id: p.identity, username: p.identity, avatar: undefined })
    })
    // Fetch usernames for remote participants
    const remoteIds = names.slice(1).map(n => n.id)
    if (remoteIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', remoteIds)
      if (data) {
        data.forEach(p => {
          const idx = names.findIndex(n => n.id === p.id)
          if (idx > -1) { names[idx].username = p.username; names[idx].avatar = p.avatar_url ?? undefined }
        })
      }
    }
    setParticipants(names)
  }, [profile])

  // Attach remote audio tracks
  const attachAudio = useCallback((track: any, participantId: string) => {
    let el = audioElements.current.get(participantId)
    if (!el) {
      el = document.createElement('audio')
      el.autoplay = true
      document.body.appendChild(el)
      audioElements.current.set(participantId, el)
    }
    track.attach(el)
  }, [])

  const detachAudio = useCallback((participantId: string) => {
    const el = audioElements.current.get(participantId)
    if (el) { el.remove(); audioElements.current.delete(participantId) }
  }, [])

  useEffect(() => {
    if (!profile) return
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      stopLocalTrackOnUnpublish: true,
    })
    roomRef.current = room

    room.on(RoomEvent.Connected, async () => {
      setConnected(true)
      // Publish microphone
      try {
        const audioTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true })
        await room.localParticipant.publishTrack(audioTrack)
      } catch (e) { console.error('Mic error:', e) }
      updateParticipants()
    })

    room.on(RoomEvent.Disconnected, () => {
      setConnected(false)
      // Clean up audio elements
      audioElements.current.forEach(el => el.remove())
      audioElements.current.clear()
    })

    room.on(RoomEvent.ParticipantConnected, () => updateParticipants())
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      detachAudio(p.identity)
      updateParticipants()
    })

    // Auto-attach incoming audio tracks
    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        attachAudio(track, participant.identity)
      }
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        if (screenShareVideoRef.current) track.attach(screenShareVideoRef.current)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach()
        detachAudio(participant.identity)
      }
    })

    // Connect
    const connect = async () => {
      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: `server-voice-${channel.id}`, identity: profile.id }),
      })
      if (!res.ok) return
      const { token } = await res.json()
      try {
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
          autoSubscribe: true,
        } as RoomConnectOptions)
      } catch (e) { console.error('Connect error:', e) }
    }
    connect()

    // Register in voice_sessions
    supabase.from('voice_sessions').upsert({ channel_id: channel.id, user_id: profile.id }, { onConflict: 'channel_id,user_id' })

    return () => {
      room.disconnect()
      supabase.from('voice_sessions').delete().eq('channel_id', channel.id).eq('user_id', profile.id)
    }
  }, [channel.id, profile?.id])

  useEffect(() => {
    if (!connected) return
    const interval = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [connected])

  const toggleMute = useCallback(async () => {
    if (!roomRef.current) return
    const newMuted = !muted
    setMuted(newMuted)
    const pubs = roomRef.current.localParticipant.audioTrackPublications
    pubs.forEach((pub: LocalTrackPublication) => {
      if (pub.track) newMuted ? pub.track.mute() : pub.track.unmute()
    })
  }, [muted])

  const toggleDeafen = useCallback(() => {
    if (!roomRef.current) return
    const newDeafened = !deafened
    setDeafened(newDeafened)
    // Mute/unmute all remote audio elements
    audioElements.current.forEach(el => { el.volume = newDeafened ? 0 : 1 })
  }, [deafened])

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return
    if (sharing) {
      await roomRef.current.localParticipant.setScreenShareEnabled(false)
      setSharing(false)
    } else {
      try {
        await roomRef.current.localParticipant.setScreenShareEnabled(true, { audio: true })
        setSharing(true)
      } catch (e) { console.error('Screen share:', e) }
    }
  }, [sharing])

  const handleLeave = useCallback(async () => {
    roomRef.current?.disconnect()
    await supabase.from('voice_sessions').delete().eq('channel_id', channel.id).eq('user_id', profile?.id)
    setVoiceMembers(channel.id, [])
    onLeave()
  }, [channel.id, profile?.id, onLeave])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0d0d14' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <Volume2 size={16} strokeWidth={1.75} style={{ color: '#3dff9a', flexShrink: 0 }} />
        <p className="font-syne font-semibold text-sm flex-1" style={{ color: '#f0eeff' }}>{channel.name}</p>
        <span className="text-xs px-2 py-1 rounded-lg"
          style={{ background: connected ? 'rgba(61,255,154,0.1)' : 'rgba(255,255,255,0.05)', color: connected ? '#3dff9a' : 'rgba(255,255,255,0.3)' }}>
          {connected ? fmt(duration) : 'Bağlanıyor...'}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
        {/* Screen share */}
        {sharing && (
          <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#000', maxHeight: '50%', border: '1px solid rgba(192,68,255,0.3)' }}>
            <video ref={screenShareVideoRef} autoPlay muted className="w-full h-full object-contain" />
          </div>
        )}

        {/* Participants */}
        <div className="flex flex-wrap justify-center gap-6">
          {participants.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center font-semibold text-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)', border: `3px solid ${p.id === profile?.id && muted ? 'rgba(255,107,157,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                  {p.avatar
                    ? <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                    : p.username.slice(0, 2).toUpperCase()}
                </div>
                {p.id === profile?.id && muted && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: '#ff6b9d', border: '2px solid #0d0d14' }}>
                    <MicOff size={10} strokeWidth={2.5} style={{ color: 'white' }} />
                  </div>
                )}
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.username}</span>
            </div>
          ))}
        </div>

        {!connected && (
          <p className="text-sm animate-pulse" style={{ color: 'rgba(255,255,255,0.4)' }}>Bağlanıyor...</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-6 flex-shrink-0">
        <VoiceBtn
          onClick={toggleMute}
          icon={muted ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
          label={muted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
          active={muted} danger />
        <VoiceBtn
          onClick={toggleDeafen}
          icon={deafened ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
          label={deafened ? 'Sesi Aç' : 'Sesi Kapat'}
          active={deafened} danger />
        <VoiceBtn
          onClick={toggleScreenShare}
          icon={<MonitorUp size={18} strokeWidth={2} />}
          label="Ekran Paylaş"
          active={sharing} accent />
        <button onClick={handleLeave} title="Ayrıl"
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
          style={{ background: 'rgba(255,107,157,0.2)', border: '2px solid rgba(255,107,157,0.4)', color: '#ff6b9d' }}>
          <PhoneOff size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

function VoiceBtn({ onClick, icon, label, active, danger, accent }: {
  onClick: () => void; icon: React.ReactNode; label: string; active?: boolean; danger?: boolean; accent?: boolean
}) {
  return (
    <button onClick={onClick} title={label}
      className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        background: active && danger ? 'rgba(255,107,157,0.2)' : active && accent ? 'rgba(192,68,255,0.2)' : 'rgba(255,255,255,0.06)',
        border: `2px solid ${active && danger ? 'rgba(255,107,157,0.4)' : active && accent ? 'rgba(192,68,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
        color: active && danger ? '#ff6b9d' : active && accent ? '#c044ff' : 'rgba(255,255,255,0.7)',
      }}>
      {icon}
    </button>
  )
}
