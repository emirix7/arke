'use client'
import { useEffect, useState, useRef } from 'react'
import { Room, RoomEvent, Track, createLocalAudioTrack, RoomConnectOptions } from 'livekit-client'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
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

    // Attach incoming audio tracks
    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        let el = audioElements.current.get(participant.identity)
        if (!el) {
          el = document.createElement('audio')
          el.autoplay = true
          document.body.appendChild(el)
          audioElements.current.set(participant.identity, el)
        }
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
      setOtherSpeaking(speakers.some(s => s.identity !== currentUser?.id))
    })

    const connect = async () => {
      try {
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, { autoSubscribe: true } as RoomConnectOptions)
      } catch (e) { console.error('Connect error:', e) }
    }
    connect()

    return () => {
      room.disconnect()
      audioElements.current.forEach(el => el.remove())
      audioElements.current.clear()
    }
  }, [status, token])

  useEffect(() => {
    if (!roomRef.current || !connected) return
    roomRef.current.localParticipant.audioTrackPublications.forEach(pub => {
      if (pub.track) muted ? pub.track.mute() : pub.track.unmute()
    })
  }, [muted, connected])

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
  const avatarInitials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
      style={{ background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(20px)' }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(192,68,255,0.1) 0%, transparent 70%)' }} />
      </div>

      <p className="text-xs font-semibold tracking-widest uppercase mb-8"
        style={{ color: 'rgba(255,255,255,0.3)' }}>
        {status === 'calling' ? 'Aranıyor...' : status === 'ringing' ? 'Gelen Arama' : connected ? fmt(duration) : 'Bağlanıyor...'}
      </p>

      <div className="flex items-center gap-8 mb-10">
        {/* Other user */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {otherSpeaking && status === 'connected' && (
              <div className="absolute -inset-2 rounded-full"
                style={{ border: '2px solid #3dff9a', boxShadow: '0 0 12px rgba(61,255,154,0.4)' }} />
            )}
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)', border: `3px solid ${otherSpeaking ? '#3dff9a' : 'rgba(255,255,255,0.1)'}`, transition: 'border-color 0.15s', position: 'relative' }}>
              {displayUser?.avatar_url
                ? <img src={displayUser.avatar_url} alt="" className="w-full h-full object-cover" />
                : avatarInitials}
            </div>
          </div>
          <p className="font-syne font-semibold text-sm" style={{ color: '#f0eeff' }}>{displayName}</p>
        </div>

        <div className="flex items-center gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1 rounded-full transition-all duration-500"
              style={{
                height: status === 'connected' ? [20, 32, 20][i] : 8,
                background: status === 'connected' ? '#3dff9a' : 'rgba(255,255,255,0.2)',
                animation: status === 'connected' ? `pulse-dot ${0.8 + i * 0.2}s ease-in-out infinite alternate` : 'none',
              }} />
          ))}
        </div>

        {/* Current user */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #c044ff)', border: '3px solid rgba(255,255,255,0.1)', opacity: muted ? 0.5 : 1 }}>
            {currentUser?.avatar_url
              ? <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
              : (currentUser?.username ?? 'Sen').slice(0, 2).toUpperCase()}
          </div>
          <p className="font-syne font-semibold text-sm" style={{ color: '#f0eeff' }}>
            {currentUser?.username ?? 'Sen'}
            {muted && <span className="ml-1 text-xs" style={{ color: '#ff6b9d' }}> (sessiz)</span>}
          </p>
        </div>
      </div>

      {status === 'ringing' && isIncoming ? (
        <div className="flex gap-6">
          <CallBtn onClick={onDecline!} icon={<PhoneOff size={22} strokeWidth={2} />} label="Reddet" color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.4)" />
          <CallBtn onClick={onAccept!} icon={<Phone size={22} strokeWidth={2} />} label="Kabul Et" color="#3dff9a" bg="rgba(61,255,154,0.2)" border="rgba(61,255,154,0.4)" />
        </div>
      ) : status === 'calling' ? (
        <CallBtn onClick={onEnd} icon={<PhoneOff size={22} strokeWidth={2} />} label="İptal" color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.4)" />
      ) : (
        <div className="flex gap-4">
          <CallBtn onClick={onToggleMute} icon={muted ? <MicOff size={20} strokeWidth={2} /> : <Mic size={20} strokeWidth={2} />}
            label={muted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'} color={muted ? '#ff6b9d' : 'rgba(255,255,255,0.6)'}
            bg={muted ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.06)'} border={muted ? 'rgba(255,107,157,0.35)' : 'rgba(255,255,255,0.1)'} />
          <CallBtn onClick={onToggleDeafen} icon={deafened ? <VolumeX size={20} strokeWidth={2} /> : <Volume2 size={20} strokeWidth={2} />}
            label={deafened ? 'Sesi Aç' : 'Sesi Kapat'} color={deafened ? '#ff6b9d' : 'rgba(255,255,255,0.6)'}
            bg={deafened ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.06)'} border={deafened ? 'rgba(255,107,157,0.35)' : 'rgba(255,255,255,0.1)'} />
          <CallBtn onClick={onEnd} icon={<PhoneOff size={20} strokeWidth={2} />} label="Bitir"
            color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.4)" />
        </div>
      )}
    </div>
  )
}

function CallBtn({ onClick, icon, label, color, bg, border }: {
  onClick: () => void; icon: React.ReactNode; label: string; color: string; bg: string; border: string
}) {
  return (
    <button onClick={onClick} title={label}
      className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150"
      style={{ background: bg, border: `2px solid ${border}`, color }}>
      {icon}
    </button>
  )
}
