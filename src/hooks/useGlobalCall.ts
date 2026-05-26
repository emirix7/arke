'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { startCallRinging, stopCallRinging } from '@/lib/notificationSound'

interface IncomingCallInfo {
  callId: string; roomName: string; callerId: string
  callerName: string; callerAvatar?: string
}

export function useGlobalCall() {
  const { profile } = useAuthStore()
  const { conversations, setActiveConversation } = useChatStore()
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null)

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`global_calls:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'call_signals',
        filter: `receiver_id=eq.${profile.id}`,
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status !== 'ringing') return
        const { data: caller } = await supabase.from('profiles')
          .select('username, avatar_url').eq('id', signal.caller_id).single()
        setIncomingCall({
          callId: signal.id, roomName: signal.room_name,
          callerId: signal.caller_id,
          callerName: caller?.username ?? 'Bilinmeyen',
          callerAvatar: caller?.avatar_url
        })
        startCallRinging()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'call_signals',
      }, (payload) => {
        const signal = payload.new as any
        if (signal.status === 'ended' || signal.status === 'declined') {
          stopCallRinging()
          setIncomingCall(null)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel); stopCallRinging() }
  }, [profile?.id])

  // Clear banner when call is accepted from anywhere (ChatArea etc)
  useEffect(() => {
    const { listeners } = require('@/hooks/useVoiceCall')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listener = (state: any) => {
      if (state.status === 'connected' || state.status === 'idle') {
        stopCallRinging()
        setIncomingCall(null)
      }
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !profile) return
    stopCallRinging()
    // Get token and connect
    const { getLiveKitToken } = await import('@/lib/livekit')
    const { playCallConnected } = await import('@/lib/notificationSound')
    const token = await getLiveKitToken(incomingCall.roomName, profile.id)
    if (!token) return
    // Update call signal
    await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', incomingCall.callId)
    playCallConnected()
    // Update global call state so VoiceCallOverlay shows
    const { setGlobalCall } = await import('@/hooks/useVoiceCall')
    setGlobalCall({
      active: true, status: 'connected', roomName: incomingCall.roomName,
      token, callId: incomingCall.callId, isIncoming: true,
      callerProfile: { username: incomingCall.callerName, avatar_url: incomingCall.callerAvatar }
    })
    // Navigate to the conversation
    const conv = conversations.find(c => c.other_user.id === incomingCall.callerId)
    if (conv) setActiveConversation(conv)
    setIncomingCall(null)
  }, [incomingCall, profile, conversations])

  const declineCall = useCallback(async () => {
    if (!incomingCall) return
    stopCallRinging()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', incomingCall.callId)
    setIncomingCall(null)
    // Clear global call state
    const { setGlobalCall, defaultState } = await import('@/hooks/useVoiceCall')
    setGlobalCall({ ...defaultState })
  }, [incomingCall])

  return { incomingCall, acceptCall, declineCall }
}
