import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'

interface IncomingCallInfo {
  callId: string
  roomName: string
  callerId: string
  callerName: string
  callerAvatar?: string
}

// Global audio context for ringing
let ringingCtx: AudioContext | null = null
let ringStopped = false

function startRinging() {
  ringStopped = false
  ringingCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const play = () => {
    if (ringStopped || !ringingCtx) return
    ;[0, 250].forEach(delay => {
      setTimeout(() => {
        if (ringStopped || !ringingCtx) return
        const osc = ringingCtx!.createOscillator()
        const gain = ringingCtx!.createGain()
        osc.connect(gain); gain.connect(ringingCtx!.destination)
        osc.frequency.value = 520
        gain.gain.setValueAtTime(0.25, ringingCtx!.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ringingCtx!.currentTime + 0.2)
        osc.start(); osc.stop(ringingCtx!.currentTime + 0.2)
      }, delay)
    })
    setTimeout(play, 3500)
  }
  play()
}

function stopRinging() {
  ringStopped = true
  ringingCtx?.close()
  ringingCtx = null
}

export function useGlobalCall() {
  const { profile } = useAuthStore()
  const { conversations, setActiveConversation } = useChatStore()
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null)
  const [acceptedCallInfo, setAcceptedCallInfo] = useState<IncomingCallInfo | null>(null)

  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel(`global_calls:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `receiver_id=eq.${profile.id}`,
      }, async (payload) => {
        const signal = payload.new as any
        if (signal.status !== 'ringing') return

        const { data: caller } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', signal.caller_id)
          .single()

        setIncomingCall({
          callId: signal.id,
          roomName: signal.room_name,
          callerId: signal.caller_id,
          callerName: caller?.username ?? 'Bilinmeyen',
          callerAvatar: caller?.avatar_url,
        })
        startRinging()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_signals',
      }, (payload) => {
        const signal = payload.new as any
        if (signal.status === 'ended' || signal.status === 'declined') {
          stopRinging()
          setIncomingCall(null)
          setAcceptedCallInfo(null)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel); stopRinging() }
  }, [profile?.id])

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !profile) return
    stopRinging()

    await supabase.from('call_signals').update({ status: 'accepted' }).eq('id', incomingCall.callId)

    // Find or open conversation with caller
    const conv = conversations.find(c =>
      c.other_user.id === incomingCall.callerId
    )
    if (conv) setActiveConversation(conv)

    setAcceptedCallInfo(incomingCall)
    setIncomingCall(null)
  }, [incomingCall, profile, conversations])

  const declineCall = useCallback(async () => {
    if (!incomingCall) return
    stopRinging()
    await supabase.from('call_signals').update({ status: 'declined' }).eq('id', incomingCall.callId)
    setIncomingCall(null)
  }, [incomingCall])

  return { incomingCall, acceptedCallInfo, acceptCall, declineCall }
}
