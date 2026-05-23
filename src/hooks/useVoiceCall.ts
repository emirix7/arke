'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { getLiveKitToken } from '@/lib/livekit'
import { startCallRinging, stopCallRinging, startDialing, stopDialing, playCallConnected } from '@/lib/notificationSound'

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
  active: false, status: 'idle', roomName: '', token: '',
  muted: false, deafened: false, callId: null, isIncoming: false, callerProfile: null,
}

// Global call state - persists across navigation
let globalCallState: CallState = { ...defaultState }
const listeners = new Set<(s: CallState) => void>()

function setGlobalCall(update: Partial<CallState>) {
  globalCallState = { ...globalCallState, ...update }
  listeners.forEach(fn => fn(globalCallState))
}

export function useVoiceCall(targetUserId: string) {
  const { profile } = useAuthStore()
  const [callState, setCallState] = useState<CallState>(globalCallState)
  const reconnectTimer = useRef<NodeJS.Timeout>()

  // Subscribe to global state
  useEffect(() => {
    const listener = (s: CallState) => setCallState({ ...s })
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  // Listen for call signals
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`calls:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'call_signals',
        filter: `receiver_id=eq.${profile.id}`,
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status !== 'ringing') return
        const { data: caller } = await supabase.from('profiles').select('username, avatar_url').eq('id', signal.caller_id).single()
        setGlobalCall({ active: true, status: 'ringing', roomName: signal.room_name, callId: signal.id, isIncoming: true, callerProfile: caller, token: '' })
        startCallRinging()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'call_signals',
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status === 'declined') {
          stopCallRinging(); stopDialing()
          setGlobalCall({ ...defaultState })
        }
        if (signal.status === 'ended') {
          stopCallRinging(); stopDialing()
          // Don't immediately end — start 3 min grace period if connected
          if (globalCallState.status === 'connected') {
            setGlobalCall({ status: 'ended' })
            reconnectTimer.current = setTimeout(() => {
              setGlobalCall({ ...defaultState })
            }, 3 * 60 * 1000) // 3 minutes
          } else {
            setGlobalCall({ ...defaultState })
          }
        }
        if (signal.status === 'accepted' && !globalCallState.isIncoming) {
          stopDialing(); playCallConnected()
          const token = await getLiveKitToken(signal.room_name, profile.id)
          if (token) setGlobalCall({ status: 'connected', token })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  const startCall = useCallback(async () => {
    if (!profile || !targetUserId) return
    // End any existing voice channel
    if (globalCallState.active) return
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
    clearTimeout(reconnectTimer.current)
    const token = await getLiveKitToken(state.roomName, profile.id)
    if (!token) return
    await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', state.callId)
    setGlobalCall({ status: 'connected', token })
  }, [profile])

  const declineCall = useCallback(async () => {
    const state = globalCallState
    if (!state.callId) return
    stopCallRinging()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', state.callId)
    setGlobalCall({ ...defaultState })
  }, [])

  const endCall = useCallback(async () => {
    const state = globalCallState
    stopCallRinging(); stopDialing()
    clearTimeout(reconnectTimer.current)
    if (state.callId) await supabase.from('call_signals').update({ status: 'ended' }).eq('id', state.callId)
    setGlobalCall({ ...defaultState })
  }, [])

  const toggleMute = useCallback(() => setGlobalCall({ muted: !globalCallState.muted }), [])
  const toggleDeafen = useCallback(() => setGlobalCall({ deafened: !globalCallState.deafened }), [])

  return { callState, startCall, acceptCall, declineCall, endCall, toggleMute, toggleDeafen }
}

// Export for use in AppShell
export { globalCallState, setGlobalCall, defaultState }
