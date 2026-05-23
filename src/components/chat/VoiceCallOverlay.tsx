'use client'
import { useEffect, useState, useRef } from 'react'
import { Room, RoomEvent, Track, createLocalAudioTrack, RoomConnectOptions } from 'livekit-client'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { getLiveKitToken } from '@/lib/livekit'
import type { Profile } from '@/types/database'
import type { CallStatus } from '@/hooks/useVoiceCall'

interface VoiceCallOverlayProps {
  roomName: string; token: string; status: CallStatus
  currentUser?: Profile | null; otherUser?: Profile
  isIncoming: boolean; callerProfile: { username: string; avatar_url?: string } | null
  onEnd: () => void; onAccept?: () => void; onDecline?: () => void
  muted: boolean; deafened: boolean
  onToggleMute: () => void; onToggleDeafen: () => void
}

export default function VoiceCallOverlay({
  roomName, token, status, currentUser, otherUser, isIncoming,
  callerProfile, onEnd, onAccept, onDecline, muted, deafened,
  onToggleMute, onToggleDeafen
}: VoiceCallOverlayProps) {
  const [duration, setDuration] = useState(0)
  const [connected, setConnected] = useState(false)
  const [otherSpeaking, setOtherSpeaking] = useState(false)
  const [mySpeaking, setMySpeaking] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    if (status !== 'connected' || !token) return
    const room = new Room({
      adaptiveStream: true, dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    roomRef.current = room

    room.on(RoomEvent.Connected, async () => {
      setConnected(true)
      try {
        const audioTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true })
        await room.localParticipant.publishTrack(audioTrack)
      } catch (e) { console.error('Mic error:', e) }
    })

    room.on(RoomEvent.Disconnected, () => {
      setConnected(false)
      audioElements.current.forEach(el => el.remove())
      audioElements.current.clear()
    })

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        let el = audioElements.current.get(participant.identity)
        if (!el) { el = document.createElement('audio'); el.autoplay = true; document.body.appendChild(el); audioElements.current.set(participant.identity, el) }
        track.attach(el)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach()
        const el = audioElements.current.get(participant.identity)
        if (el) { el.remove(); audioElements.current.delete(participant.identity) }
      }
    })

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const ids = new Set(speakers.map(s => s.identity))
      setOtherSpeaking(speakers.some(s => s.identity !== room.localParticipant.identity))
      setMySpeaking(ids.has(room.localParticipant.identity))
    })

    room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, { autoSubscribe: true } as RoomConnectOptions)
      .catch(e => console.error('Connect error:', e))

    return () => {
      room.disconnect()
      audioElements.current.forEach(el => el.remove())
      audioElements.current.clear()
    }
  }, [status, token])

  useEffect(() => {
    if (!roomRef.current) return
    roomRef.current.localParticipant.audioTrackPublications.forEach(pub => {
      if (pub.track) muted ? pub.track.mute() : pub.track.unmute()
    })
  }, [muted])

  useEffect(() => {
    audioElements.current.forEach(el => { el.volume = deafened ? 0 : 1 })
  }, [deafened])

  useEffect(() => {
    if (!connected) return
    const interval = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [connected])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const displayUser = isIncoming ? callerProfile : otherUser
  const displayName = displayUser?.username ?? '...'

  return (
    // Half-screen overlay, not full screen - sits on top half of chat
    <div className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center z-50"
      style={{ height: '45%', background: 'rgba(8,8,16,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(192,68,255,0.15)' }}>

      <p className="text-xs font-semibold tracking-widest uppercase mb-5"
        style={{ color: 'rgba(255,255,255,0.3)' }}>
        {status === 'calling' ? 'Aranıyor...' : status === 'ringing' ? 'Gelen Arama' : connected ? fmt(duration) : 'Bağlanıyor...'}
      </p>

      {/* Avatars */}
      <div className="flex items-center gap-10 mb-6">
        {/* Other user */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            {otherSpeaking && status === 'connected' && (
              <div className="absolute -inset-1.5 rounded-full"
                style={{ border: '2px solid #3dff9a', boxShadow: '0 0 10px rgba(61,255,154,0.4)', borderRadius: '50%' }} />
            )}
            <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #ff6b9d, #c044ff)',
                border: `3px solid ${otherSpeaking ? '#3dff9a' : 'rgba(255,255,255,0.1)'}`,
                transition: 'border-color 0.15s',
              }}>
              {displayUser?.avatar_url
                ? <img src={displayUser.avatar_url} alt="" className="w-full h-full object-cover" />
                : displayName.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <p className="text-xs font-medium" style={{ color: otherSpeaking ? '#3dff9a' : 'rgba(255,255,255,0.7)', transition: 'color 0.15s' }}>
            {displayName}
          </p>
        </div>

        {/* Pulse bars */}
        <div className="flex items-center gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1 rounded-full transition-all duration-300"
              style={{
                height: status === 'connected' ? [14, 22, 14][i] : 6,
                background: status === 'connected' ? '#3dff9a' : 'rgba(255,255,255,0.2)',
                animation: status === 'connected' ? `pulse-dot ${0.7 + i * 0.15}s ease-in-out infinite alternate` : 'none',
              }} />
          ))}
        </div>

        {/* Current user */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            {mySpeaking && !muted && status === 'connected' && (
              <div className="absolute -inset-1.5 rounded-full"
                style={{ border: '2px solid #3dff9a', boxShadow: '0 0 10px rgba(61,255,154,0.4)', borderRadius: '50%' }} />
            )}
            <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #c044ff)',
                border: `3px solid ${mySpeaking && !muted ? '#3dff9a' : 'rgba(255,255,255,0.1)'}`,
                opacity: muted ? 0.5 : 1, transition: 'border-color 0.15s, opacity 0.2s',
              }}>
              {currentUser?.avatar_url
                ? <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                : (currentUser?.username ?? 'Sen').slice(0, 2).toUpperCase()}
            </div>
          </div>
          <p className="text-xs font-medium" style={{ color: mySpeaking && !muted ? '#3dff9a' : 'rgba(255,255,255,0.7)', transition: 'color 0.15s' }}>
            {currentUser?.username ?? 'Sen'}
            {muted && <span style={{ color: '#ff6b9d' }}> (sessiz)</span>}
          </p>
        </div>
      </div>

      {/* Buttons */}
      {status === 'ringing' && isIncoming ? (
        <div className="flex gap-5">
          <CallBtn onClick={onDecline!} icon={<PhoneOff size={18} strokeWidth={2} />} label="Reddet" color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.4)" />
          <CallBtn onClick={onAccept!} icon={<Phone size={18} strokeWidth={2} />} label="Kabul Et" color="#3dff9a" bg="rgba(61,255,154,0.2)" border="rgba(61,255,154,0.4)" />
        </div>
      ) : status === 'calling' ? (
        <CallBtn onClick={onEnd} icon={<PhoneOff size={18} strokeWidth={2} />} label="İptal" color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.4)" />
      ) : (
        <div className="flex gap-3">
          <CallBtn onClick={onToggleMute} icon={muted ? <MicOff size={16} strokeWidth={2} /> : <Mic size={16} strokeWidth={2} />}
            label={muted ? 'Aç' : 'Kapat'} color={muted ? '#ff6b9d' : 'rgba(255,255,255,0.6)'}
            bg={muted ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.06)'} border={muted ? 'rgba(255,107,157,0.35)' : 'rgba(255,255,255,0.1)'} size="sm" />
          <CallBtn onClick={onToggleDeafen} icon={deafened ? <VolumeX size={16} strokeWidth={2} /> : <Volume2 size={16} strokeWidth={2} />}
            label={deafened ? 'Aç' : 'Kapat'} color={deafened ? '#ff6b9d' : 'rgba(255,255,255,0.6)'}
            bg={deafened ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.06)'} border={deafened ? 'rgba(255,107,157,0.35)' : 'rgba(255,255,255,0.1)'} size="sm" />
          <CallBtn onClick={onEnd} icon={<PhoneOff size={16} strokeWidth={2} />} label="Bitir"
            color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.4)" size="sm" />
        </div>
      )}
    </div>
  )
}

function CallBtn({ onClick, icon, label, color, bg, border, size = 'md' }: {
  onClick: () => void; icon: React.ReactNode; label: string
  color: string; bg: string; border: string; size?: 'sm' | 'md'
}) {
  const s = size === 'sm' ? 10 : 12
  return (
    <button onClick={onClick} title={label}
      className="rounded-full flex items-center justify-center transition-all"
      style={{ width: s * 4, height: s * 4, background: bg, border: `2px solid ${border}`, color }}>
      {icon}
    </button>
  )
}
