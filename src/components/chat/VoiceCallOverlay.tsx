'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Track, LocalVideoTrack } from 'livekit-client'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MonitorUp, MonitorOff } from 'lucide-react'
import { getGlobalRoom, setGlobalMuted, disconnectVoiceRoom } from './VoiceRoom'
import type { Profile } from '@/types/database'
import type { CallStatus } from '@/hooks/useVoiceCall'

interface Props {
  status: CallStatus
  currentUser?: Profile | null
  otherUser?: any
  isIncoming: boolean
  callerProfile: { username: string; avatar_url?: string } | null
  onEnd: () => void
  onLeave?: () => void
  onAccept?: () => void
  onDecline?: () => void
  onRejoin?: () => void
  globalMicMuted?: boolean
}

export default function VoiceCallOverlay({
  status, currentUser, otherUser, isIncoming, callerProfile,
  onEnd, onLeave, onAccept, onDecline, onRejoin, globalMicMuted,
}: Props) {
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [otherSpeaking, setOtherSpeaking] = useState(false)
  const [mySpeaking, setMySpeaking] = useState(false)
  const [remoteSharing, setRemoteSharing] = useState(false)
  const [otherAway, setOtherAway] = useState(false)
  const [graceCountdown, setGraceCountdown] = useState(180)
  const [fullscreenShare, setFullscreenShare] = useState<'local' | 'remote' | null>(null)
  const [showQualityPicker, setShowQualityPicker] = useState(false)
  const [pushToTalk, setPushToTalk] = useState(false)
  const localScreenRef = useRef<HTMLVideoElement>(null)
  const remoteScreenRef = useRef<HTMLVideoElement>(null)
  const pttActive = useRef(false)
  const isAwayRef = useRef(false)
  const otherAwayRef = useRef(false)

  const isRinging = status === 'ringing'
  const isCalling = status === 'calling'
  const isActive = status === 'connected'
  const isAway = status === 'away'

  useEffect(() => { isAwayRef.current = isAway }, [isAway])
  useEffect(() => { otherAwayRef.current = otherAway }, [otherAway])

  // Listen for other person's away via call_signals
  useEffect(() => {
    if (!otherUser?.id) return
    const { supabase } = require('@/lib/supabase')
    const ch = supabase
      .channel(`overlay_${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'call_signals',
      }, (payload: any) => {
        const s = payload.new
        if (s.status === 'away' && !isAwayRef.current) setOtherAway(true)
        if (s.status === 'accepted' && otherAwayRef.current) setOtherAway(false)
        if (s.status === 'ended') setOtherAway(false)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [otherUser?.id])

  // Speaking detection from globalRoom
  useEffect(() => {
    if (!isActive) return
    const { RoomEvent } = require('livekit-client')
    const room = getGlobalRoom()
    if (!room) return
    const handler = (speakers: any[]) => {
      const local = room.localParticipant.identity
      setOtherSpeaking(speakers.some((s: any) => s.identity !== local))
      setMySpeaking(speakers.some((s: any) => s.identity === local))
    }
    room.on(RoomEvent.ActiveSpeakersChanged, handler)
    return () => { room.off(RoomEvent.ActiveSpeakersChanged, handler) }
  }, [isActive])

  // Remote screen share detection
  useEffect(() => {
    if (!isActive) return
    const { RoomEvent, Track } = require('livekit-client')
    const room = getGlobalRoom()
    if (!room) return
    const onSub = (track: any, pub: any) => {
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        setRemoteSharing(true)
        setTimeout(() => { if (remoteScreenRef.current) track.attach(remoteScreenRef.current) }, 100)
      }
    }
    const onUnsub = (track: any) => {
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        setRemoteSharing(false)
      }
    }
    room.on(RoomEvent.TrackSubscribed, onSub)
    room.on(RoomEvent.TrackUnsubscribed, onUnsub)
    return () => { room.off(RoomEvent.TrackSubscribed, onSub); room.off(RoomEvent.TrackUnsubscribed, onUnsub) }
  }, [isActive])

  // Deafen
  useEffect(() => {
    const { globalAudioElements } = require('./VoiceRoom')
    // Can't import non-exported, use workaround
    document.querySelectorAll('audio').forEach((el: any) => { el.volume = deafened ? 0 : 1 })
  }, [deafened])

  // Global mic mute
  useEffect(() => {
    if (globalMicMuted !== undefined) {
      setGlobalMuted(!!globalMicMuted)
      setMuted(!!globalMicMuted)
    }
  }, [globalMicMuted])

  // Timer
  useEffect(() => {
    if (!isActive) return
    const t = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(t)
  }, [isActive])

  // Grace countdown
  useEffect(() => {
    if (!isAway) { setGraceCountdown(180); return }
    setGraceCountdown(180)
    const t = setInterval(() => setGraceCountdown(p => p <= 1 ? 0 : p - 1), 1000)
    return () => clearInterval(t)
  }, [isAway])

  // PTT
  useEffect(() => {
    if (!pushToTalk) {
      if (!muted) getGlobalRoom()?.localParticipant.audioTrackPublications.forEach(pub => pub.track?.unmute())
      return
    }
    getGlobalRoom()?.localParticipant.audioTrackPublications.forEach(pub => pub.track?.mute())
    const pttKey = localStorage.getItem('arke_ptt_key') || 'v'
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== pttKey || pttActive.current) return
      e.preventDefault(); pttActive.current = true
      getGlobalRoom()?.localParticipant.audioTrackPublications.forEach(pub => { if (pub.track) pub.track.unmute() })
    }
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== pttKey) return
      pttActive.current = false
      getGlobalRoom()?.localParticipant.audioTrackPublications.forEach(pub => { if (pub.track) pub.track.mute() })
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [pushToTalk, muted])

  const toggleMute = () => {
    const newMuted = !muted
    setMuted(newMuted)
    setGlobalMuted(newMuted)
  }

  const startScreenShare = async (quality = '720p30') => {
    const room = getGlobalRoom()
    if (!room) return
    setShowQualityPicker(false)
    const q: Record<string, any> = {
      '480p30': { width: 854, height: 480, frameRate: 30 },
      '720p30': { width: 1280, height: 720, frameRate: 30 },
      '720p60': { width: 1280, height: 720, frameRate: 60 },
      '1080p30': { width: 1920, height: 1080, frameRate: 30 },
      '1080p60': { width: 1920, height: 1080, frameRate: 60 },
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: q[quality], audio: false })
      const vt = stream.getVideoTracks()[0]
      if (!vt) return
      if (localScreenRef.current) localScreenRef.current.srcObject = stream
      const lkTrack = new LocalVideoTrack(vt, undefined, false)
      await room.localParticipant.publishTrack(lkTrack, { source: Track.Source.ScreenShare, simulcast: false })
      vt.onended = stopScreenShare
      setSharing(true)
    } catch (e: any) { if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') console.error(e) }
  }

  const stopScreenShare = async () => {
    const room = getGlobalRoom()
    if (localScreenRef.current?.srcObject) {
      ;(localScreenRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      localScreenRef.current.srcObject = null
    }
    try {
      room?.localParticipant.videoTrackPublications.forEach(pub => {
        if (pub.source === Track.Source.ScreenShare && pub.videoTrack)
          room.localParticipant.unpublishTrack(pub.videoTrack)
      })
    } catch {}
    setSharing(false)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const otherName = otherUser?.username ?? callerProfile?.username ?? '...'
  const otherAvatar = otherUser?.avatar_url ?? (callerProfile as any)?.avatar_url
  const myName = currentUser?.username ?? 'Sen'
  const myAvatar = currentUser?.avatar_url

  return (
    <div className="absolute inset-x-0 top-0 flex flex-col" style={{ height: '50%', background: '#0d0d1a', zIndex: 50, borderBottom: '1px solid rgba(192,68,255,0.2)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          {isCalling ? 'Aranıyor...' : isRinging ? 'Gelen Arama' : isAway ? '🔴 Aramadan ayrıldın' : isActive ? fmt(duration) : 'Bağlanıyor...'}
        </span>
        {isAway && (
          <span className="text-xs px-2 py-1 rounded-lg font-semibold"
            style={{ background: 'rgba(255,193,7,0.12)', color: '#ffc107', border: '1px solid rgba(255,193,7,0.2)' }}>
            {Math.floor(graceCountdown / 60)}:{(graceCountdown % 60).toString().padStart(2, '0')} içinde katıl
          </span>
        )}
      </div>

      {/* Screen shares */}
      {(sharing || remoteSharing) && (
        <div className="flex gap-2 px-3 pt-2 flex-shrink-0" style={{ maxHeight: '30%' }}>
          {sharing && (
            <div className="flex-1 rounded-xl overflow-hidden relative cursor-pointer group"
              style={{ background: '#000', border: '1px solid rgba(192,68,255,0.4)' }}
              onClick={() => setFullscreenShare('local')}>
              <span className="absolute top-1 left-1 z-10 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>Sen</span>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <span className="text-white text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>🔍 Büyüt</span>
              </div>
              <video ref={localScreenRef} autoPlay muted playsInline className="w-full h-full object-contain" />
            </div>
          )}
          {remoteSharing && (
            <div className="flex-1 rounded-xl overflow-hidden relative cursor-pointer group"
              style={{ background: '#000', border: '1px solid rgba(61,255,154,0.4)' }}
              onClick={() => setFullscreenShare('remote')}>
              <span className="absolute top-1 left-1 z-10 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>{otherName}</span>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <span className="text-white text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>🔍 Büyüt</span>
              </div>
              <video ref={remoteScreenRef} autoPlay playsInline className="w-full h-full object-contain" />
            </div>
          )}
        </div>
      )}

      {/* Avatars */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-10">
          {/* Other */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {otherSpeaking && isActive && !otherAway && (
                <div className="absolute -inset-1.5 rounded-full" style={{ border: '2px solid #3dff9a', borderRadius: '50%', boxShadow: '0 0 12px rgba(61,255,154,0.4)' }} />
              )}
              {otherAway ? (
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '3px dashed rgba(255,255,255,0.2)' }}>
                  <span style={{ fontSize: 24 }}>👻</span>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)', border: `3px solid ${otherSpeaking && isActive ? '#3dff9a' : 'rgba(255,255,255,0.12)'}`, transition: 'border-color 0.2s' }}>
                  {otherAvatar ? <img src={otherAvatar} alt="" className="w-full h-full object-cover" /> : otherName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <p className="text-sm font-semibold" style={{ color: otherAway ? '#ffc107' : otherSpeaking && isActive ? '#3dff9a' : 'rgba(255,255,255,0.85)', transition: 'color 0.2s' }}>
              {otherAway ? 'Ayrıldı' : otherName}
            </p>
          </div>

          {/* Pulse */}
          {(isActive || isCalling || isRinging) && (
            <div className="flex items-center gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 rounded-full" style={{ height: isActive ? [14,22,14][i] : 8, background: isActive ? '#3dff9a' : 'rgba(255,255,255,0.2)', transition: 'all 0.3s' }} />
              ))}
            </div>
          )}

          {/* Me */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {mySpeaking && !muted && isActive && (
                <div className="absolute -inset-1.5 rounded-full" style={{ border: '2px solid #3dff9a', borderRadius: '50%', boxShadow: '0 0 12px rgba(61,255,154,0.4)' }} />
              )}
              {isAway ? (
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '3px dashed rgba(255,255,255,0.2)' }}>
                  <span style={{ fontSize: 24 }}>👻</span>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #c044ff)', border: `3px solid ${mySpeaking && !muted && isActive ? '#3dff9a' : 'rgba(255,255,255,0.12)'}`, opacity: muted ? 0.7 : 1, transition: 'all 0.2s' }}>
                  {myAvatar ? <img src={myAvatar} alt="" className="w-full h-full object-cover" /> : myName.slice(0, 2).toUpperCase()}
                </div>
              )}
              {!isAway && muted && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#ff6b9d', border: '2px solid #0d0d1a' }}>
                  <MicOff size={11} strokeWidth={2.5} style={{ color: 'white' }} />
                </div>
              )}
            </div>
            <p className="text-sm font-semibold" style={{ color: isAway ? '#ffc107' : mySpeaking && !muted && isActive ? '#3dff9a' : 'rgba(255,255,255,0.85)', transition: 'color 0.2s' }}>
              {isAway ? 'Ayrıldın' : myName}
            </p>
          </div>
        </div>
      </div>

      {/* Quality picker */}
      {showQualityPicker && (
        <div className="absolute bottom-20 left-1/2 z-50 rounded-xl overflow-hidden" style={{ transform: 'translateX(-50%)', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', minWidth: 180 }}>
          <p className="px-3 py-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>Kalite Seç</p>
          {[['480p30','480p 30fps'],['720p30','720p 30fps'],['720p60','720p 60fps'],['1080p30','1080p 30fps'],['1080p60','1080p 60fps']].map(([val, label]) => (
            <button key={val} onClick={() => startScreenShare(val)}
              className="w-full flex items-center px-3 py-2 text-sm text-left"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              {label}
            </button>
          ))}
          <button onClick={() => setShowQualityPicker(false)} className="w-full px-3 py-2 text-sm" style={{ color: '#ff6b9d', borderTop: '1px solid rgba(255,255,255,0.07)' }}>İptal</button>
        </div>
      )}

      {pushToTalk && (
        <div className="absolute bottom-16 left-1/2 text-xs px-3 py-1.5 rounded-xl z-10"
          style={{ transform: 'translateX(-50%)', background: 'rgba(192,68,255,0.1)', border: '1px solid rgba(192,68,255,0.2)', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
          Bas-Konuş — <strong style={{ color: '#c044ff' }}>{(localStorage.getItem('arke_ptt_key') || 'V').toUpperCase()}</strong>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-4 flex-shrink-0">
        {isRinging && isIncoming ? (
          <>
            <Btn onClick={onDecline!} icon={<PhoneOff size={20} strokeWidth={2} />} color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.5)" size={52} label="Reddet" />
            <Btn onClick={onAccept!} icon={<Phone size={20} strokeWidth={2} />} color="#3dff9a" bg="rgba(61,255,154,0.2)" border="rgba(61,255,154,0.5)" size={52} label="Kabul Et" />
          </>
        ) : isCalling ? (
          <Btn onClick={onEnd} icon={<PhoneOff size={20} strokeWidth={2} />} color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.5)" size={52} label="İptal" />
        ) : isAway ? (
          <>
            <Btn onClick={onRejoin!} icon={<Phone size={18} strokeWidth={2} />} color="#3dff9a" bg="rgba(61,255,154,0.15)" border="rgba(61,255,154,0.4)" label="Geri Katıl" />
            <Btn onClick={onEnd} icon={<PhoneOff size={18} strokeWidth={2} />} color="#ff6b9d" bg="rgba(255,107,157,0.15)" border="rgba(255,107,157,0.4)" label="Aramayı Bitir" />
          </>
        ) : (
          <>
            <Btn onClick={toggleMute} icon={muted ? <MicOff size={16} strokeWidth={2} /> : <Mic size={16} strokeWidth={2} />}
              color={muted ? '#ff6b9d' : 'rgba(255,255,255,0.7)'} bg={muted ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.08)'} border={muted ? 'rgba(255,107,157,0.4)' : 'rgba(255,255,255,0.15)'} label={muted ? 'Aç' : 'Sessize Al'} />
            <Btn onClick={() => setDeafened(p => !p)} icon={deafened ? <VolumeX size={16} strokeWidth={2} /> : <Volume2 size={16} strokeWidth={2} />}
              color={deafened ? '#ff6b9d' : 'rgba(255,255,255,0.7)'} bg={deafened ? 'rgba(255,107,157,0.15)' : 'rgba(255,255,255,0.08)'} border={deafened ? 'rgba(255,107,157,0.4)' : 'rgba(255,255,255,0.15)'} label={deafened ? 'Sesi Aç' : 'Kapat'} />
            <Btn onClick={sharing ? stopScreenShare : () => setShowQualityPicker(p => !p)}
              icon={sharing ? <MonitorOff size={16} strokeWidth={2} /> : <MonitorUp size={16} strokeWidth={2} />}
              color={sharing ? '#c044ff' : 'rgba(255,255,255,0.7)'} bg={sharing ? 'rgba(192,68,255,0.15)' : 'rgba(255,255,255,0.08)'} border={sharing ? 'rgba(192,68,255,0.4)' : 'rgba(255,255,255,0.15)'} label="Ekran" />
            <Btn onClick={() => setPushToTalk(p => !p)} icon={<Mic size={16} strokeWidth={2} />}
              color={pushToTalk ? '#c044ff' : 'rgba(255,255,255,0.7)'} bg={pushToTalk ? 'rgba(192,68,255,0.15)' : 'rgba(255,255,255,0.08)'} border={pushToTalk ? 'rgba(192,68,255,0.4)' : 'rgba(255,255,255,0.15)'} label="Bas-Konuş" />
            <Btn onClick={onLeave ?? onEnd} icon={<PhoneOff size={16} strokeWidth={2} />} color="#ff6b9d" bg="rgba(255,107,157,0.2)" border="rgba(255,107,157,0.5)" label="Ayrıl" />
          </>
        )}
      </div>

      {/* Fullscreen modal */}
      {fullscreenShare && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)' }} onClick={() => setFullscreenShare(null)}>
          <div className="relative w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <video ref={el => {
              if (!el) return
              const src = fullscreenShare === 'local' ? localScreenRef.current : remoteScreenRef.current
              if (src?.srcObject) el.srcObject = src.srcObject as MediaStream
            }} autoPlay muted={fullscreenShare === 'local'} playsInline className="max-w-full max-h-full rounded-xl" style={{ objectFit: 'contain' }} />
            <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={() => {
                const src = fullscreenShare === 'local' ? localScreenRef.current : remoteScreenRef.current
                if (!src?.srcObject) return
                const win = window.open('', '_blank', 'width=1280,height=720')
                if (!win) return
                win.document.write('<html><body style="margin:0;background:#000"><video autoplay style="width:100%;height:100vh;object-fit:contain"></video></body></html>')
                win.document.close()
                const v = win.document.querySelector('video') as HTMLVideoElement
                if (v) v.srcObject = src.srcObject as MediaStream
              }} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                ↗ Yeni Pencere
              </button>
              <button onClick={() => setFullscreenShare(null)} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: 'rgba(255,107,157,0.2)', color: '#ff6b9d', border: '1px solid rgba(255,107,157,0.3)' }}>
                ✕ Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Btn({ onClick, icon, color, bg, border, size = 40, label }: {
  onClick: () => void; icon: React.ReactNode; color: string; bg: string; border: string; size?: number; label?: string
}) {
  return (
    <button onClick={onClick} title={label} className="rounded-full flex items-center justify-center transition-all flex-shrink-0"
      style={{ width: size, height: size, background: bg, border: `2px solid ${border}`, color }}>
      {icon}
    </button>
  )
}
