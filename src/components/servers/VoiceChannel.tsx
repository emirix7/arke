'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Room, RoomEvent, Track, ParticipantEvent,
  createLocalAudioTrack, RoomConnectOptions, LocalParticipant
} from 'livekit-client'
import { Mic, MicOff, Volume2, VolumeX, MonitorUp, PhoneOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useServerStore } from '@/store/server'
import { getLiveKitToken } from '@/lib/livekit'
import { supabase } from '@/lib/supabase'
import type { Channel } from '@/types/server'

interface VoiceChannelProps {
  channel: Channel
  onLeave: () => void
  globalMicMuted?: boolean
}

interface Participant {
  id: string; username: string; avatar?: string; speaking: boolean; muted: boolean
}

export default function VoiceChannel({ channel, onLeave, globalMicMuted }: VoiceChannelProps) {
  const { profile } = useAuthStore()
  const { setVoiceMembers } = useServerStore()
  const roomRef = useRef<Room | null>(null)
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map())
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [pushToTalk, setPushToTalk] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [duration, setDuration] = useState(0)
  const screenShareVideoRef = useRef<HTMLVideoElement>(null)
  const pttActive = useRef(false)

  const updateParticipants = useCallback(async () => {
    if (!roomRef.current || !profile) return
    const list: Participant[] = [{ id: profile.id, username: profile.username, avatar: profile.avatar_url ?? undefined, speaking: false, muted }]
    const remoteIds: string[] = []
    roomRef.current.remoteParticipants.forEach(p => { remoteIds.push(p.identity); list.push({ id: p.identity, username: p.identity, avatar: undefined, speaking: false, muted: false }) })
    if (remoteIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', remoteIds)
      if (data) data.forEach(p => { const idx = list.findIndex(n => n.id === p.id); if (idx > -1) { list[idx].username = p.username; list[idx].avatar = p.avatar_url ?? undefined } })
    }
    setParticipants(list)
    setVoiceMembers(channel.id, list.map(p => ({ userId: p.id, username: p.username, avatar: p.avatar })))
  }, [profile, muted, channel.id])

  useEffect(() => {
    if (!profile) return
    const room = new Room({
      adaptiveStream: true, dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      stopLocalTrackOnUnpublish: true,
    })
    roomRef.current = room

    room.on(RoomEvent.Connected, async () => {
      setConnected(true)
      try {
        const audioTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true })
        await room.localParticipant.publishTrack(audioTrack)
      } catch (e) { console.error('Mic error:', e) }
      updateParticipants()
    })

    room.on(RoomEvent.Disconnected, () => {
      setConnected(false)
      audioElements.current.forEach(el => el.remove())
      audioElements.current.clear()
    })

    room.on(RoomEvent.ParticipantConnected, () => updateParticipants())
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      const el = audioElements.current.get(p.identity)
      if (el) { el.remove(); audioElements.current.delete(p.identity) }
      updateParticipants()
    })

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        let el = audioElements.current.get(participant.identity)
        if (!el) { el = document.createElement('audio'); el.autoplay = true; document.body.appendChild(el); audioElements.current.set(participant.identity, el) }
        track.attach(el)
      }
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        if (screenShareVideoRef.current) track.attach(screenShareVideoRef.current)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach()
        const el = audioElements.current.get(participant.identity)
        if (el) { el.remove(); audioElements.current.delete(participant.identity) }
      }
    })

    // Speaking detection
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const speakerIds = new Set(speakers.map(s => s.identity))
      setParticipants(prev => prev.map(p => ({ ...p, speaking: speakerIds.has(p.id) || (p.id === profile.id && speakerIds.has(room.localParticipant.identity)) })))
    })

    const connect = async () => {
      const token = await getLiveKitToken(`server-voice-${channel.id}`, profile.id)
      if (!token) return
      try { await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, { autoSubscribe: true } as RoomConnectOptions) } catch (e) { console.error('Connect error:', e) }
    }
    connect()
    // Upsert with user_id unique constraint - replaces any existing session
    const joinSession = async () => {
      await supabase.from('voice_sessions').delete().eq('user_id', profile.id)
      await new Promise(r => setTimeout(r, 100)) // small delay to ensure delete completes
      await supabase.from('voice_sessions').insert({ channel_id: channel.id, user_id: profile.id })
    }
    joinSession()

    return () => {
      room.disconnect()
      audioElements.current.forEach(el => el.remove())
      audioElements.current.clear()
      // Use synchronous cleanup
      supabase.from('voice_sessions').delete().eq('user_id', profile.id).then(() => {})
    }
  }, [channel.id, profile?.id])

  // Sync global mic mute
  useEffect(() => {
    if (!roomRef.current || !connected) return
    roomRef.current.localParticipant.audioTrackPublications.forEach(pub => {
      if (pub.track) globalMicMuted ? pub.track.mute() : (!muted && pub.track.unmute())
    })
  }, [globalMicMuted, connected])

  useEffect(() => {
    if (!connected) return
    const interval = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [connected])

  // Push to talk keyboard handler
  useEffect(() => {
    if (!pushToTalk) return
    const pttKey = localStorage.getItem('arke_ptt_key') || 'v'
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== pttKey || pttActive.current) return
      pttActive.current = true
      roomRef.current?.localParticipant.audioTrackPublications.forEach(pub => pub.track?.unmute())
    }
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== pttKey) return
      pttActive.current = false
      roomRef.current?.localParticipant.audioTrackPublications.forEach(pub => pub.track?.mute())
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [pushToTalk])

  const toggleMute = useCallback(async () => {
    if (!roomRef.current) return
    const newMuted = !muted
    setMuted(newMuted)
    roomRef.current.localParticipant.audioTrackPublications.forEach(pub => {
      if (pub.track) newMuted ? pub.track.mute() : pub.track.unmute()
    })
    setParticipants(prev => prev.map(p => p.id === profile?.id ? { ...p, muted: newMuted } : p))
  }, [muted, profile?.id])

  const toggleDeafen = useCallback(() => {
    const newDeafened = !deafened
    setDeafened(newDeafened)
    audioElements.current.forEach(el => { el.volume = newDeafened ? 0 : 1 })
  }, [deafened])

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return
    if (sharing) { await roomRef.current.localParticipant.setScreenShareEnabled(false); setSharing(false) }
    else { try { await roomRef.current.localParticipant.setScreenShareEnabled(true, { audio: true }); setSharing(true) } catch {} }
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
        {sharing && (
          <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#000', maxHeight: '50%', border: '1px solid rgba(192,68,255,0.3)' }}>
            <video ref={screenShareVideoRef} autoPlay muted className="w-full h-full object-contain" />
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-6">
          {participants.map(p => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className="relative">
                {/* Speaking ring */}
                {p.speaking && !p.muted && (
                  <div className="absolute -inset-1.5 rounded-full"
                    style={{ border: '2px solid #3dff9a', boxShadow: '0 0 12px rgba(61,255,154,0.5)', borderRadius: '50%' }} />
                )}
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center font-semibold text-xl text-white"
                  style={{
                    background: 'linear-gradient(135deg, #c044ff, #00d4ff)',
                    border: `3px solid ${p.speaking && !p.muted ? '#3dff9a' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'border-color 0.15s',
                  }}>
                  {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.username.slice(0, 2).toUpperCase()}
                </div>
                {p.muted && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: '#ff6b9d', border: '2px solid #0d0d14' }}>
                    <MicOff size={10} strokeWidth={2.5} style={{ color: 'white' }} />
                  </div>
                )}
              </div>
              <span className="text-xs" style={{ color: p.speaking ? '#3dff9a' : 'rgba(255,255,255,0.6)', transition: 'color 0.15s' }}>{p.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Push to talk indicator */}
      {pushToTalk && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-xl text-xs text-center flex-shrink-0"
          style={{ background: 'rgba(192,68,255,0.08)', border: '1px solid rgba(192,68,255,0.2)', color: 'rgba(255,255,255,0.5)' }}>
          Bas-Konuş aktif — <strong style={{ color: '#c044ff' }}>{(localStorage.getItem('arke_ptt_key') || 'V').toUpperCase()}</strong> tuşuna bas
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pb-6 flex-shrink-0">
        <VoiceBtn onClick={toggleMute} icon={muted ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />} label={muted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'} active={muted} danger />
        <VoiceBtn onClick={toggleDeafen} icon={deafened ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />} label={deafened ? 'Sesi Aç' : 'Sesi Kapat'} active={deafened} danger />
        <VoiceBtn onClick={toggleScreenShare} icon={<MonitorUp size={18} strokeWidth={2} />} label="Ekran Paylaş" active={sharing} accent />
        <VoiceBtn onClick={() => setPushToTalk(p => !p)} icon={<Mic size={18} strokeWidth={2} />} label="Bas-Konuş" active={pushToTalk} accent />
        <button onClick={handleLeave} title="Ayrıl"
          className="w-12 h-12 rounded-full flex items-center justify-center"
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
