'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
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

export function useVoiceCall(targetUserId: string) {
  const { profile } = useAuthStore()
  const [callState, setCallState] = useState<CallState>(defaultState)

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`incoming_calls:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'call_signals',
        filter: `receiver_id=eq.${profile.id}`,
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status !== 'ringing') return
        const { data: caller } = await supabase.from('profiles').select('username, avatar_url').eq('id', signal.caller_id).single()
        setCallState({ ...defaultState, active: true, status: 'ringing', roomName: signal.room_name, callId: signal.id, isIncoming: true, callerProfile: caller })
        startCallRinging()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'call_signals',
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status === 'declined' || signal.status === 'ended') {
          stopCallRinging(); stopDialing()
          setCallState(defaultState)
        }
        if (signal.status === 'accepted') {
          stopDialing(); playCallConnected()
          const res = await fetch('/api/livekit-token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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
  }, [profile?.id])

  const startCall = useCallback(async () => {
    if (!profile || !targetUserId) return
    const roomName = [profile.id, targetUserId].sort().join('-')
    const { data: signal } = await supabase.from('call_signals')
      .insert({ caller_id: profile.id, receiver_id: targetUserId, room_name: roomName, status: 'ringing' })
      .select().single()
    if (!signal) return
    setCallState({ ...defaultState, active: true, status: 'calling', roomName, callId: signal.id, isIncoming: false, callerProfile: null })
    startDialing()
  }, [profile, targetUserId])

  const acceptCall = useCallback(async () => {
    if (!callState.callId || !profile) return
    stopCallRinging(); playCallConnected()
    const res = await fetch('/api/livekit-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: callState.roomName, identity: profile.id }),
    })
    if (!res.ok) return
    const { token } = await res.json()
    await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', callState.callId)
    setCallState(prev => ({ ...prev, status: 'connected', token }))
  }, [callState.callId, callState.roomName, profile])

  const declineCall = useCallback(async () => {
    if (!callState.callId) return
    stopCallRinging()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', callState.callId)
    setCallState(defaultState)
  }, [callState.callId])

  const endCall = useCallback(async () => {
    stopCallRinging(); stopDialing()
    if (callState.callId) await supabase.from('call_signals').update({ status: 'ended' }).eq('id', callState.callId)
    setCallState(defaultState)
  }, [callState.callId])

  const toggleMute = useCallback(() => setCallState(p => ({ ...p, muted: !p.muted })), [])
  const toggleDeafen = useCallback(() => setCallState(p => ({ ...p, deafened: !p.deafened })), [])

  return { callState, startCall, acceptCall, declineCall, endCall, toggleMute, toggleDeafen }
}
