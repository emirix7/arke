'use client'
import { useEffect, useRef } from 'react'
import { Room, RoomEvent, Track, createLocalAudioTrack, RoomConnectOptions } from 'livekit-client'

interface VoiceRoomProps {
  token: string
  roomName: string
  globalMicMuted?: boolean
}

// Global room instance - persists across navigations
let globalRoom: Room | null = null
let globalAudioElements: Map<string, HTMLAudioElement> = new Map()
let globalMuted = false

export function getGlobalRoom() { return globalRoom }
export function getGlobalMuted() { return globalMuted }

export function setGlobalMuted(muted: boolean) {
  globalMuted = muted
  if (globalRoom) {
    globalRoom.localParticipant.audioTrackPublications.forEach(pub => {
      if (pub.track) muted ? pub.track.mute() : pub.track.unmute()
    })
  }
}

export default function VoiceRoom({ token, roomName, globalMicMuted }: VoiceRoomProps) {
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    // Disconnect old room if exists
    if (globalRoom) {
      globalRoom.disconnect()
      globalAudioElements.forEach(el => el.remove())
      globalAudioElements.clear()
      globalRoom = null
    }

    const room = new Room({
      adaptiveStream: true, dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    globalRoom = room

    room.on(RoomEvent.Connected, async () => {
      try {
        const audioTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true })
        await room.localParticipant.publishTrack(audioTrack)
        if (globalMicMuted) audioTrack.mute()
      } catch (e) { console.error('Mic:', e) }
    })

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        let el = globalAudioElements.get(participant.identity)
        if (!el) {
          el = document.createElement('audio')
          el.autoplay = true
          document.body.appendChild(el)
          globalAudioElements.set(participant.identity, el)
        }
        track.attach(el)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach()
        const el = globalAudioElements.get(participant.identity)
        if (el) { el.remove(); globalAudioElements.delete(participant.identity) }
      }
    })

    room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, { autoSubscribe: true } as RoomConnectOptions)
      .catch(e => console.error('VoiceRoom connect:', e))

    return () => {
      // Don't disconnect on unmount - this component is always mounted while call active
    }
  }, [token])

  // Apply global mic mute
  useEffect(() => {
    setGlobalMuted(!!globalMicMuted)
  }, [globalMicMuted])

  return null // No UI
}

// Cleanup function - call when ending call
export function disconnectVoiceRoom() {
  if (globalRoom) {
    globalRoom.disconnect()
    globalAudioElements.forEach(el => el.remove())
    globalAudioElements.clear()
    globalRoom = null
  }
}
