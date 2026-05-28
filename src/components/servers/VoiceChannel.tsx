'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Room, RoomEvent, Track, LocalTrack,
  createLocalAudioTrack, RoomConnectOptions
} from 'livekit-client'
import { Mic, MicOff, Volume2, VolumeX, MonitorUp, MonitorOff, PhoneOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useServerStore } from '@/store/server'
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

interface ScreenShare {
  participantId: string; username: string; track: any
}

export default function VoiceChannel({ channel, onLeave, globalMicMuted }: VoiceChannelProps) {
  const { profile } = useAuthStore()
  const { setVoiceMembers } = useServerStore()
  const roomRef = useRef<Room | null>(null)
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map())
  const screenVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const localScreenRef = useRef<HTMLVideoElement>(null)
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [pushToTalk, setPushToTalk] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([])
  const [duration, setDuration] = useState(0)
  const [showQualityPicker, setShowQualityPicker] = useState(false)
  const [fullscreenShare, setFullscreenShare] = useState<string | null>(null)
  const pttActive = useRef(false)

  const updateParticipants = useCallback(async () => {
    if (!roomRef.current || !profile) return
    const list: Participant[] = [{ id: profile.id, username: profile.username, avatar: profile.avatar_url ?? undefined, speaking: false, muted }]
    const remoteIds: string[] = []
    roomRef.current.remoteParticipants.forEach(p => { remoteIds.push(p.identity); list.push({ id: p.identity, username: p.identity, avatar: undefined, speaking: false, muted: false }) })
    if (remoteIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', remoteIds)
      if (data) data.forEach((p: any) => { const idx = list.findIndex(n => n.id === p.id); if (idx > -1) { list[idx].username = p.username; list[idx].avatar = p.avatar_url ?? undefined } })
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
      setScreenShares(prev => prev.filter(s => s.participantId !== p.identity))
      updateParticipants()
    })

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        let el = audioElements.current.get(participant.identity)
        if (!el) { el = document.createElement('audio'); el.autoplay = true; document.body.appendChild(el); audioElements.current.set(participant.identity, el) }
        track.attach(el)
      }
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        setScreenShares(prev => {
          const existing = prev.find(s => s.participantId === participant.identity)
          if (existing) return prev
          return [...prev, { participantId: participant.identity, username: participant.identity, track }]
        })
        // Attach to video element after state update
        setTimeout(() => {
          const videoEl = screenVideoRefs.current.get(participant.identity)
          if (videoEl) track.attach(videoEl)
        }, 100)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach()
        const el = audioElements.current.get(participant.identity)
        if (el) { el.remove(); audioElements.current.delete(participant.identity) }
      }
      if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
        setScreenShares(prev => prev.filter(s => s.participantId !== participant.identity))
      }
    })

    room.on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.track?.source === Track.Source.ScreenShare) {
        // Attach local screen share to preview
        setTimeout(() => {
          if (localScreenRef.current && pub.track) {
            pub.track.attach(localScreenRef.current)
          }
        }, 100)
      }
    })

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const speakerIds = new Set(speakers.map(s => s.identity))
      setParticipants(prev => prev.map(p => ({ ...p, speaking: speakerIds.has(p.id) || (p.id === profile.id && speakerIds.has(room.localParticipant.identity)) })))
    })

    const connect = async () => {
      const res = await fetch('/api/livekit-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: `server-voice-${channel.id}`, identity: profile.id }),
      })
      if (!res.ok) return
      const { token } = await res.json()
      try { await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, { autoSubscribe: true } as RoomConnectOptions) } catch (e) { console.error('Connect error:', e) }
    }
    connect()

    const joinSession = async () => {
      // Remove own old sessions + stale sessions older than 10 min
      await supabase.from('voice_sessions').delete().eq('user_id', profile.id)
      // Only delete own stale sessions (RLS restriction)
      await supabase.from('voice_sessions').delete()
        .eq('user_id', profile.id)
        .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      await new Promise(r => setTimeout(r, 100))
      await supabase.from('voice_sessions').insert({ channel_id: channel.id, user_id: profile.id })
    }
    joinSession()

    // Cleanup on page close/refresh
    const handleUnload = () => {
      supabase.from('voice_sessions').delete().eq('user_id', profile.id)
      room.disconnect()
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      room.disconnect()
      audioElements.current.forEach(el => el.remove())
      audioElements.current.clear()
      supabase.from('voice_sessions').delete().eq('user_id', profile.id).then(() => {})
    }
  }, [channel.id, profile?.id])

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

  // PTT
  useEffect(() => {
    if (!pushToTalk) {
      if (!muted) roomRef.current?.localParticipant.audioTrackPublications.forEach(pub => pub.track?.unmute())
      return
    }
    roomRef.current?.localParticipant.audioTrackPublications.forEach(pub => pub.track?.mute())
    const pttKey = localStorage.getItem('arke_ptt_key') || 'v'
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== pttKey || pttActive.current) return
      e.preventDefault(); pttActive.current = true
      roomRef.current?.localParticipant.audioTrackPublications.forEach(pub => { if (pub.track) pub.track.unmute() })
    }
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== pttKey) return
      pttActive.current = false
      roomRef.current?.localParticipant.audioTrackPublications.forEach(pub => { if (pub.track) pub.track.mute() })
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [pushToTalk, muted])

  const toggleMute = useCallback(async () => {
    if (!roomRef.current) return
    const newMuted = !muted
    setMuted(newMuted)
    try {
      // Try setMicrophoneEnabled first (most reliable)
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted)
    } catch {
      // Fallback to manual mute/unmute
      roomRef.current.localParticipant.audioTrackPublications.forEach(pub => {
        if (pub.track) newMuted ? pub.track.mute() : pub.track.unmute()
      })
    }
    setParticipants(prev => prev.map(p => p.id === profile?.id ? { ...p, muted: newMuted } : p))
  }, [muted, profile?.id])

  const toggleDeafen = useCallback(() => {
    const newDeafened = !deafened; setDeafened(newDeafened)
    audioElements.current.forEach(el => { el.volume = newDeafened ? 0 : 1 })
  }, [deafened])

  const startScreenShare = useCallback(async (quality: string) => {
    if (!roomRef.current || !connected) return
    setShowQualityPicker(false)
    const qualityMap: Record<string, any> = {
      '480p30': { width: 854, height: 480, framerate: 30 },
      '720p30': { width: 1280, height: 720, framerate: 30 },
      '720p60': { width: 1280, height: 720, framerate: 60 },
      '1080p30': { width: 1920, height: 1080, framerate: 30 },
      '1080p60': { width: 1920, height: 1080, framerate: 60 },
    }
    const res = qualityMap[quality] || qualityMap['720p30']
    try {
      // Use navigator.mediaDevices directly for better control
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: res.width, height: res.height, frameRate: res.framerate },
        audio: false,
      })
      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack) return

      // Attach to local preview immediately
      if (localScreenRef.current) {
        localScreenRef.current.srcObject = stream
      }

      // Publish to LiveKit
      const { LocalVideoTrack, Track } = await import('livekit-client')
      const livekitTrack = new LocalVideoTrack(videoTrack, undefined, false)
      await roomRef.current.localParticipant.publishTrack(livekitTrack, {
        source: Track.Source.ScreenShare,
        simulcast: false,
      })

      videoTrack.onended = () => { stopScreenShare() }
      setSharing(true)
    } catch (e: any) {
      if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
        console.error('Screen share error:', e)
      }
    }
  }, [connected])

  const stopScreenShare = useCallback(async () => {
    if (!roomRef.current) return
    // Stop local stream tracks
    if (localScreenRef.current?.srcObject) {
      const stream = localScreenRef.current.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
      localScreenRef.current.srcObject = null
    }
    // Unpublish from LiveKit
    try {
      const { Track } = await import('livekit-client')
      roomRef.current.localParticipant.videoTrackPublications.forEach((pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          roomRef.current!.localParticipant.unpublishTrack(pub.videoTrack!)
        }
      })
    } catch (e) { console.error('Stop share:', e) }
    setSharing(false)
  }, [])

  const handleLeave = useCallback(async () => {
    roomRef.current?.disconnect()
    await supabase.from('voice_sessions').delete().eq('channel_id', channel.id).eq('user_id', profile?.id)
    setVoiceMembers(channel.id, [])
    onLeave()
  }, [channel.id, profile?.id, onLeave])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const allScreenShares = sharing
    ? [{ participantId: 'local', username: profile?.username ?? 'Sen', track: null }, ...screenShares]
    : screenShares

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

      <div className="flex-1 flex flex-col overflow-auto p-4 gap-4">
        {/* Screen shares */}
        {allScreenShares.length > 0 && (
          <div className="flex flex-col gap-2">
            {allScreenShares.map(ss => (
              <div key={ss.participantId} className="rounded-2xl overflow-hidden group cursor-pointer"
                style={{ background: '#000', border: '1px solid rgba(192,68,255,0.3)', position: 'relative' }}
                onClick={() => setFullscreenShare(ss.participantId)}>
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg text-xs"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                  {ss.username} paylaşıyor
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <span className="text-white text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>🔍 Büyüt</span>
                </div>
                {ss.participantId === 'local' ? (
                  <video ref={localScreenRef} autoPlay muted playsInline
                    className="w-full" style={{ maxHeight: '40vh', objectFit: 'contain' }} />
                ) : (
                  <video ref={el => { if (el) { screenVideoRefs.current.set(ss.participantId, el); if (ss.track) ss.track.attach(el) } }}
                    autoPlay playsInline className="w-full" style={{ maxHeight: '40vh', objectFit: 'contain' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Participants */}
        <div className="flex flex-wrap justify-center gap-6">
          {participants.map(p => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className="relative">
                {p.speaking && !p.muted && (
                  <div className="absolute -inset-1.5 rounded-full"
                    style={{ border: '2px solid #3dff9a', boxShadow: '0 0 12px rgba(61,255,154,0.5)', borderRadius: '50%' }} />
                )}
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center font-semibold text-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)', border: `3px solid ${p.speaking && !p.muted ? '#3dff9a' : 'rgba(255,255,255,0.1)'}`, transition: 'border-color 0.15s' }}>
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

      {pushToTalk && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-xl text-xs text-center flex-shrink-0"
          style={{ background: 'rgba(192,68,255,0.08)', border: '1px solid rgba(192,68,255,0.2)', color: 'rgba(255,255,255,0.5)' }}>
          Bas-Konuş aktif — <strong style={{ color: '#c044ff' }}>{(localStorage.getItem('arke_ptt_key') || 'V').toUpperCase()}</strong> tuşuna bas
        </div>
      )}

      {/* Quality picker */}
      {showQualityPicker && (
        <div className="mx-5 mb-2 rounded-xl overflow-hidden flex-shrink-0"
          style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="px-3 py-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            Ekran Paylaşım Kalitesi
          </p>
          {[
            { label: '480p 30fps', value: '480p30' },
            { label: '720p 30fps', value: '720p30' },
            { label: '720p 60fps', value: '720p60' },
            { label: '1080p 30fps', value: '1080p30' },
            { label: '1080p 60fps', value: '1080p60' },
          ].map(q => (
            <button key={q.value} onClick={() => startScreenShare(q.value)}
              className="w-full flex items-center px-3 py-2 text-sm text-left transition-all"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              {q.label}
            </button>
          ))}
          <button onClick={() => setShowQualityPicker(false)}
            className="w-full flex items-center px-3 py-2 text-sm text-left"
            style={{ color: '#ff6b9d', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            İptal
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pb-6 flex-shrink-0">
        <VoiceBtn onClick={toggleMute} icon={muted ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />} label={muted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'} active={muted} danger />
        <VoiceBtn onClick={toggleDeafen} icon={deafened ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />} label={deafened ? 'Sesi Aç' : 'Sesi Kapat'} active={deafened} danger />
        <VoiceBtn
          onClick={() => sharing ? stopScreenShare() : setShowQualityPicker(p => !p)}
          icon={sharing ? <MonitorOff size={18} strokeWidth={2} /> : <MonitorUp size={18} strokeWidth={2} />}
          label={sharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'} active={sharing} accent />
        <VoiceBtn onClick={() => setPushToTalk(p => !p)} icon={<Mic size={18} strokeWidth={2} />} label="Bas-Konuş" active={pushToTalk} accent />
        <button onClick={handleLeave} title="Ayrıl"
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,107,157,0.2)', border: '2px solid rgba(255,107,157,0.4)', color: '#ff6b9d' }}>
          <PhoneOff size={18} strokeWidth={2} />
        </button>
      </div>
    {/* Fullscreen modal */}
      {fullscreenShare && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setFullscreenShare(null)}>
          <div className="relative w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            {fullscreenShare === 'local' ? (
              <video ref={el => { 
                if (el && localScreenRef.current?.srcObject) {
                  el.srcObject = localScreenRef.current.srcObject as MediaStream
                }
              }}
                autoPlay muted playsInline className="max-w-full max-h-full rounded-xl" style={{ objectFit: 'contain' }} />
            ) : (
              <video ref={el => {
                if (el && fullscreenShare) {
                  const src = screenVideoRefs.current.get(fullscreenShare)
                  if (src?.srcObject) el.srcObject = src.srcObject as MediaStream
                }
              }} autoPlay playsInline className="max-w-full max-h-full rounded-xl" style={{ objectFit: 'contain' }} />
            )}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => {
                  const src = fullscreenShare === 'local' ? localScreenRef.current : screenVideoRefs.current.get(fullscreenShare)
                  if (!src?.srcObject) return
                  const win = window.open('', '_blank', 'width=1280,height=720')
                  if (!win) return
                  win.document.write('<html><body style="margin:0;background:#000"><video autoplay style="width:100%;height:100vh;object-fit:contain"></video></body></html>')
                  win.document.close()
                  const v = win.document.querySelector('video') as HTMLVideoElement
                  if (v) v.srcObject = (src.srcObject as MediaStream)
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                ↗ Yeni Pencere
              </button>
              <button onClick={() => setFullscreenShare(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(255,107,157,0.2)', color: '#ff6b9d', border: '1px solid rgba(255,107,157,0.3)' }}>
                ✕ Kapat
              </button>
            </div>
          </div>
        </div>
      )}
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
