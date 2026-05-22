import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'

export interface CallState {
  active: boolean
  status: CallStatus
  roomName: string
  token: string
  muted: boolean
  deafened: boolean
  callId: string | null
  isIncoming: boolean
  callerProfile: { username: string; avatar_url?: string } | null
}

const defaultState: CallState = {
  active: false,
  status: 'idle',
  roomName: '',
  token: '',
  muted: false,
  deafened: false,
  callId: null,
  isIncoming: false,
  callerProfile: null,
}

export function useVoiceCall(targetUserId: string) {
  const { profile } = useAuthStore()
  const [callState, setCallState] = useState<CallState>(defaultState)
  const callingAudioRef = useRef<HTMLAudioElement | null>(null)
  const ringingAudioRef = useRef<HTMLAudioElement | null>(null)

  // Tone generators for calling/ringing sounds
  const playCallingTone = useCallback(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    let stopped = false
    const play = () => {
      if (stopped) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 440
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
      setTimeout(() => play(), 2000)
    }
    play()
    callingAudioRef.current = { stop: () => { stopped = true; ctx.close() } } as any
  }, [])

  const playRingingTone = useCallback(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    let stopped = false
    const play = () => {
      if (stopped) return
      [0, 200].forEach(delay => {
        setTimeout(() => {
          if (stopped) return
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = 480
          gain.gain.setValueAtTime(0.2, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
          osc.start()
          osc.stop(ctx.currentTime + 0.15)
        }, delay)
      })
      setTimeout(() => play(), 3000)
    }
    play()
    ringingAudioRef.current = { stop: () => { stopped = true; ctx.close() } } as any
  }, [])

  const stopTones = useCallback(() => {
    ;(callingAudioRef.current as any)?.stop?.()
    ;(ringingAudioRef.current as any)?.stop?.()
  }, [])

  // Listen for incoming calls
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`incoming_calls:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `receiver_id=eq.${profile.id}`,
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status !== 'ringing') return
        // Get caller profile
        const { data: caller } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', signal.caller_id)
          .single()

        setCallState({
          ...defaultState,
          active: true,
          status: 'ringing',
          roomName: signal.room_name,
          callId: signal.id,
          isIncoming: true,
          callerProfile: caller,
        })
        playRingingTone()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_signals',
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status === 'declined' || signal.status === 'ended') {
          stopTones()
          setCallState(defaultState)
        }
        if (signal.status === 'accepted' && !callState.isIncoming) {
          // Outgoing call was accepted - get token and connect
          stopTones()
          const res = await fetch('/api/livekit-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName: signal.room_name, identity: profile.id }),
          })
          if (res.ok) {
            const { token } = await res.json()
            setCallState(prev => ({ ...prev, status: 'connected', token }))
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, callState.isIncoming])

  const startCall = useCallback(async () => {
    if (!profile || !targetUserId) return
    const roomName = [profile.id, targetUserId].sort().join('-')

    const { data: signal } = await supabase
      .from('call_signals')
      .insert({ caller_id: profile.id, receiver_id: targetUserId, room_name: roomName, status: 'ringing' })
      .select()
      .single()

    if (!signal) return

    setCallState({
      ...defaultState,
      active: true,
      status: 'calling',
      roomName,
      callId: signal.id,
      isIncoming: false,
      callerProfile: null,
    })
    playCallingTone()
  }, [profile, targetUserId, playCallingTone])

  const acceptCall = useCallback(async () => {
    if (!callState.callId || !profile) return
    stopTones()

    const res = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: callState.roomName, identity: profile.id }),
    })
    if (!res.ok) return
    const { token } = await res.json()

    await supabase
      .from('call_signals')
      .update({ status: 'accepted' })
      .eq('id', callState.callId)

    setCallState(prev => ({ ...prev, status: 'connected', token }))
  }, [callState.callId, callState.roomName, profile, stopTones])

  const declineCall = useCallback(async () => {
    if (!callState.callId) return
    stopTones()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', callState.callId)
    setCallState(defaultState)
  }, [callState.callId, stopTones])

  const endCall = useCallback(async () => {
    stopTones()
    if (callState.callId) {
      await supabase.from('call_signals').update({ status: 'ended' }).eq('id', callState.callId)
    }
    setCallState(defaultState)
  }, [callState.callId, stopTones])

  const toggleMute = useCallback(() => setCallState(p => ({ ...p, muted: !p.muted })), [])
  const toggleDeafen = useCallback(() => setCallState(p => ({ ...p, deafened: !p.deafened })), [])

  return { callState, startCall, acceptCall, declineCall, endCall, toggleMute, toggleDeafen }
}
