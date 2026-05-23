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
        const { data: caller } = await supabase.from('profiles').select('username, avatar_url').eq('id', signal.caller_id).single()
        setIncomingCall({ callId: signal.id, roomName: signal.room_name, callerId: signal.caller_id, callerName: caller?.username ?? 'Bilinmeyen', callerAvatar: caller?.avatar_url })
        startCallRinging()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'call_signals',
      }, (payload) => {
        const signal = payload.new as any
        if (signal.status === 'ended' || signal.status === 'declined') {
          stopCallRinging(); setIncomingCall(null)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel); stopCallRinging() }
  }, [profile?.id])

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !profile) return
    stopCallRinging()
    await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', incomingCall.callId)
    const conv = conversations.find(c => c.other_user.id === incomingCall.callerId)
    if (conv) setActiveConversation(conv)
    setIncomingCall(null)
  }, [incomingCall, profile, conversations])

  const declineCall = useCallback(async () => {
    if (!incomingCall) return
    stopCallRinging()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', incomingCall.callId)
    setIncomingCall(null)
  }, [incomingCall])

  return { incomingCall, acceptCall, declineCall }
}
