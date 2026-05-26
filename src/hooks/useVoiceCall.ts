'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { getLiveKitToken } from '@/lib/livekit'
import { startCallRinging, stopCallRinging, startDialing, stopDialing, playCallConnected } from '@/lib/notificationSound'

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'away'

export interface CallState {
  active: boolean
  status: CallStatus
  roomName: string
  token: string
  callId: string | null
  isIncoming: boolean
  callerProfile: { username: string; avatar_url?: string } | null
}

const defaultState: CallState = {
  active: false, status: 'idle', roomName: '', token: '',
  callId: null, isIncoming: false, callerProfile: null,
}

let globalCallState: CallState = { ...defaultState }
const listeners = new Set<(s: CallState) => void>()

function setGlobalCall(update: Partial<CallState>) {
  globalCallState = { ...globalCallState, ...update }
  listeners.forEach(fn => fn({ ...globalCallState }))
}

export { globalCallState, setGlobalCall, defaultState, listeners }

// ─── Hook used in ChatArea ────────────────────────────────────────────────────
export function useVoiceCall(targetUserId: string) {
  const { profile } = useAuthStore()
  const [callState, setCallState] = useState<CallState>(globalCallState)
  const graceTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const listener = (s: CallState) => setCallState({ ...s })
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  // Listen for signals targeted at me
  useEffect(() => {
    if (!profile) return
    // Cleanup stale signals on mount
    supabase.from('call_signals')
      .update({ status: 'ended' })
      .or(`caller_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .in('status', ['ringing', 'away'])
      .lt('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .then(() => {})
    const ch = supabase
      .channel(`calls:${profile.id}:${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'call_signals',
        filter: `receiver_id=eq.${profile.id}`,
      }, async (payload) => {
        const s = payload.new as any
        if (s.status !== 'ringing') return
        const { data: caller } = await supabase.from('profiles')
          .select('username, avatar_url').eq('id', s.caller_id).single()
        setGlobalCall({ active: true, status: 'ringing', roomName: s.room_name, callId: s.id, isIncoming: true, callerProfile: caller })
        startCallRinging()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'call_signals',
      }, async (payload) => {
        const s = payload.new as any
        if (s.status === 'declined') {
          stopCallRinging(); stopDialing()
          setGlobalCall({ ...defaultState })
        }
        // Someone left - only affect the one who left, other stays connected
        if (s.status === 'away') {
          // If I'm already 'away', this is my own signal reflecting back - ignore
          if (globalCallState.status === 'away') return
          // If I'm connected, the OTHER person left - I stay connected
          // Just update timer so if they don't come back in 3 min, end call
          if (globalCallState.status === 'connected') {
            clearTimeout(graceTimer.current)
            graceTimer.current = setTimeout(async () => {
              // 3 min passed, other person didn't rejoin - end call
              if (globalCallState.status === 'connected') {
                const state = globalCallState
                if (state.callId) await supabase.from('call_signals').update({ status: 'ended' }).eq('id', state.callId)
                setGlobalCall({ ...defaultState })
              }
            }, 3 * 60 * 1000)
          }
        }
        // Both sides ended
        if (s.status === 'ended') {
          stopCallRinging(); stopDialing()
          clearTimeout(graceTimer.current)
          setGlobalCall({ ...defaultState })
        }
        // Callee accepted - caller gets token and connects
        if (s.status === 'accepted' && !globalCallState.isIncoming) {
          stopDialing(); playCallConnected()
          const token = await getLiveKitToken(s.room_name, profile.id)
          if (token) setGlobalCall({ status: 'connected', token })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id])

  const startCall = useCallback(async () => {
    if (!profile || !targetUserId || globalCallState.active) return
    // Clean up any stale signals
    await supabase.from('call_signals')
      .update({ status: 'ended' })
      .eq('caller_id', profile.id)
      .in('status', ['ringing', 'away'])
    const roomName = [profile.id, targetUserId].sort().join('-')
    const { data: signal } = await supabase.from('call_signals')
      .insert({ caller_id: profile.id, receiver_id: targetUserId, room_name: roomName, status: 'ringing' })
      .select().single()
    if (!signal) return
    setGlobalCall({ active: true, status: 'calling', roomName, callId: signal.id, isIncoming: false, callerProfile: null, token: '' })
    startDialing()
  }, [profile, targetUserId])

  const acceptCall = useCallback(async () => {
    const state = globalCallState
    if (!state.callId || !profile) return
    stopCallRinging(); playCallConnected()
    clearTimeout(graceTimer.current)
    const token = await getLiveKitToken(state.roomName, profile.id)
    if (!token) return
    await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', state.callId)
    setGlobalCall({ status: 'connected', token })
  }, [profile])

  // Rejoin during grace period - get fresh token, reconnect
  const rejoinCall = useCallback(async () => {
    const state = globalCallState
    if (!profile || !state.roomName) return
    clearTimeout(graceTimer.current)
    const token = await getLiveKitToken(state.roomName, profile.id)
    if (!token) return
    if (state.callId) await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', state.callId)
    // Force token change to trigger Room reconnect
    setGlobalCall({ token: '' })
    setTimeout(() => setGlobalCall({ status: 'connected', token, active: true }), 80)
  }, [profile])

  const declineCall = useCallback(async () => {
    const state = globalCallState
    if (!state.callId) return
    stopCallRinging()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', state.callId)
    setGlobalCall({ ...defaultState })
  }, [])

  // Leave call temporarily (grace period) - only this user goes away
  const leaveCall = useCallback(async () => {
    const state = globalCallState
    stopCallRinging(); stopDialing()
    // Set local state to away immediately
    setGlobalCall({ status: 'away', token: '' })
    // Signal the other person
    if (state.callId) await supabase.from('call_signals').update({ status: 'away' }).eq('id', state.callId)
    // Start my own 3-min timer
    clearTimeout(graceTimer.current)
    graceTimer.current = setTimeout(() => {
      if (globalCallState.status === 'away') setGlobalCall({ ...defaultState })
    }, 3 * 60 * 1000)
  }, [])

  // Fully end call for both sides
  const endCall = useCallback(async () => {
    const state = globalCallState
    stopCallRinging(); stopDialing()
    clearTimeout(graceTimer.current)
    if (state.callId) await supabase.from('call_signals').update({ status: 'ended' }).eq('id', state.callId)
    setGlobalCall({ ...defaultState })
  }, [])

  return { callState, startCall, acceptCall, rejoinCall, declineCall, leaveCall, endCall }
}

// ─── Hook used in AppShell (no duplicate subscriptions) ─────────────────────
export function useGlobalVoiceCall() {
  const { profile } = useAuthStore()
  const [callState, setLocalState] = useState<CallState>(globalCallState)
  const graceTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const listener = (s: CallState) => setLocalState({ ...s })
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const acceptCall = useCallback(async () => {
    const state = globalCallState
    if (!profile) return
    stopCallRinging(); playCallConnected()
    clearTimeout(graceTimer.current)
    const token = await getLiveKitToken(state.roomName, profile.id)
    if (!token) return
    if (state.callId) await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', state.callId)
    setGlobalCall({ status: 'connected', token })
  }, [profile])

  const rejoinCall = useCallback(async () => {
    const state = globalCallState
    if (!profile || !state.roomName) return
    clearTimeout(graceTimer.current)
    const token = await getLiveKitToken(state.roomName, profile.id)
    if (!token) return
    if (state.callId) await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', state.callId)
    setGlobalCall({ token: '' })
    setTimeout(() => setGlobalCall({ status: 'connected', token, active: true }), 80)
  }, [profile])

  const declineCall = useCallback(async () => {
    const state = globalCallState
    if (!state.callId) return
    stopCallRinging()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', state.callId)
    setGlobalCall({ ...defaultState })
  }, [])

  const leaveCall = useCallback(async () => {
    const state = globalCallState
    stopCallRinging(); stopDialing()
    setGlobalCall({ status: 'away', token: '' })
    if (state.callId) await supabase.from('call_signals').update({ status: 'away' }).eq('id', state.callId)
    clearTimeout(graceTimer.current)
    graceTimer.current = setTimeout(() => {
      if (globalCallState.status === 'away') setGlobalCall({ ...defaultState })
    }, 3 * 60 * 1000)
  }, [])

  const endCall = useCallback(async () => {
    const state = globalCallState
    stopCallRinging(); stopDialing()
    clearTimeout(graceTimer.current)
    if (state.callId) await supabase.from('call_signals').update({ status: 'ended' }).eq('id', state.callId)
    setGlobalCall({ ...defaultState })
  }, [])

  const toggleMute = useCallback(() => {}, [])
  const toggleDeafen = useCallback(() => {}, [])

  return { callState, acceptCall, rejoinCall, declineCall, leaveCall, endCall, toggleMute, toggleDeafen }
}
