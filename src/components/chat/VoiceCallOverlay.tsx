'use client'
import { useEffect, useState, useRef } from 'react'
import { Room, RoomEvent, ConnectionState } from 'livekit-client'
import type { Profile } from '@/types/database'
import type { CallStatus } from '@/hooks/useVoiceCall'

interface VoiceCallOverlayProps {
  roomName: string
  token: string
  status: CallStatus
  currentUser?: Profile | null
  otherUser?: Profile
  isIncoming: boolean
  callerProfile: { username: string; avatar_url?: string } | null
  onEnd: () => void
  onAccept?: () => void
  onDecline?: () => void
  muted: boolean
  deafened: boolean
  onToggleMute: () => void
  onToggleDeafen: () => void
}

export default function VoiceCallOverlay({
  roomName, token, status, currentUser, otherUser, isIncoming,
  callerProfile, onEnd, onAccept, onDecline, muted, deafened,
  onToggleMute, onToggleDeafen
}: VoiceCallOverlayProps) {
  const [duration, setDuration] = useState(0)
  const [connected, setConnected] = useState(false)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    if (status !== 'connected' || !token) return

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true },
    })
    roomRef.current = room

    room.on(RoomEvent.Connected, () => setConnected(true))
    room.on(RoomEvent.Disconnected, () => setConnected(false))

    const connect = async () => {
      try {
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token)
        await room.localParticipant.setMicrophoneEnabled(true)
      } catch (e) {
        console.error('LiveKit connection error:', e)
      }
    }
    connect()

    return () => { room.disconnect() }
  }, [status, token])

  useEffect(() => {
    if (!roomRef.current) return
    roomRef.current.localParticipant?.setMicrophoneEnabled(!muted).catch(() => {})
  }, [muted])

  useEffect(() => {
    if (!connected) return
    const interval = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [connected])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    return `${m}:${(s % 60).toString().padStart(2, '0')}`
  }

  const displayUser = isIncoming ? callerProfile : otherUser
  const displayName = displayUser?.username ?? '...'
  const avatarInitials = displayName.slice(0, 2).toUpperCase()

  const gradients = ['linear-gradient(135deg,#ff6b9d,#c044ff)', 'linear-gradient(135deg,#00d4ff,#c044ff)']

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-50"
      style={{ background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(20px)' }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(192,68,255,0.12) 0%, transparent 70%)' }} />
      </div>

      {/* Status */}
      <p className="text-xs font-semibold tracking-widest uppercase mb-8"
        style={{ color: 'rgba(255,255,255,0.3)' }}>
        {status === 'calling' ? 'Aranıyor...' :
         status === 'ringing' ? 'Gelen Arama' :
         connected ? formatDuration(duration) : 'Bağlanıyor...'}
      </p>

      {/* Avatars */}
      <div className="flex items-center gap-8 mb-10">
        {/* Other user / caller */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {status === 'connected' && (
              <div className="absolute -inset-2 rounded-full animate-ping"
                style={{ background: 'rgba(61,255,154,0.15)' }} />
            )}
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: gradients[0], border: '3px solid rgba(255,255,255,0.1)' }}
            >
              {displayUser?.avatar_url
                ? <img src={displayUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                : avatarInitials}
            </div>
          </div>
          <p className="font-syne font-semibold text-sm" style={{ color: '#f0eeff' }}>{displayName}</p>
        </div>

        {/* Wave / connecting indicator */}
        <div className="flex items-center gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1 rounded-full"
              style={{
                height: status === 'connected' ? [20, 32, 20][i] : 8,
                background: status === 'connected' ? '#3dff9a' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.5s ease',
                animation: status === 'connected' ? `pulse-dot ${0.8 + i * 0.2}s ease-in-out infinite alternate` : 'none',
              }}
            />
          ))}
        </div>

        {/* Current user */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: gradients[1], border: '3px solid rgba(255,255,255,0.1)', opacity: muted ? 0.5 : 1 }}
          >
            {currentUser?.avatar_url
              ? <img src={currentUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              : (currentUser?.username ?? 'Sen').slice(0, 2).toUpperCase()}
          </div>
          <p className="font-syne font-semibold text-sm" style={{ color: '#f0eeff' }}>
            {currentUser?.username ?? 'Sen'}
            {muted && <span className="ml-1 text-xs" style={{ color: '#ff6b9d' }}>🔇</span>}
          </p>
        </div>
      </div>

      {/* Buttons */}
      {status === 'ringing' && isIncoming ? (
        // Incoming call — accept / decline
        <div className="flex gap-6">
          <button
            onClick={onDecline}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-150"
            style={{ background: 'rgba(255,107,157,0.2)', border: '2px solid rgba(255,107,157,0.4)' }}
            title="Reddet"
          >
            📵
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-150"
            style={{ background: 'rgba(61,255,154,0.2)', border: '2px solid rgba(61,255,154,0.4)' }}
            title="Kabul Et"
          >
            📞
          </button>
        </div>
      ) : status === 'calling' ? (
        // Outgoing call — cancel
        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-150"
          style={{ background: 'rgba(255,107,157,0.2)', border: '2px solid rgba(255,107,157,0.4)' }}
          title="İptal Et"
        >
          📵
        </button>
      ) : (
        // Connected — controls
        <div className="flex gap-4">
          <CallBtn
            active={muted}
            onClick={onToggleMute}
            icon={muted ? '🔇' : '🎤'}
            label={muted ? 'Mikrofon Kapalı' : 'Mikrofon'}
            activeColor="#ff6b9d"
          />
          <CallBtn
            active={deafened}
            onClick={onToggleDeafen}
            icon={deafened ? '🔕' : '🔊'}
            label={deafened ? 'Ses Kapalı' : 'Ses'}
            activeColor="#ff6b9d"
          />
          <button
            onClick={onEnd}
            className="w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-150"
            style={{ background: 'rgba(255,107,157,0.2)', border: '2px solid rgba(255,107,157,0.4)' }}
          >
            <span style={{ fontSize: 20 }}>📵</span>
          </button>
        </div>
      )}
    </div>
  )
}

function CallBtn({ active, onClick, icon, label, activeColor }: {
  active: boolean; onClick: () => void; icon: string; label: string; activeColor: string
}) {
  return (
    <button
      onClick={onClick}
      className="w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-150"
      style={{
        background: active ? `rgba(255,107,157,0.15)` : 'rgba(255,255,255,0.06)',
        border: `2px solid ${active ? 'rgba(255,107,157,0.35)' : 'rgba(255,255,255,0.1)'}`,
      }}
      title={label}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
    </button>
  )
}
