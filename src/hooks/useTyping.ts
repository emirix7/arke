import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useTyping(conversationId: string, otherUserId: string) {
  const { profile } = useAuthStore()
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const typingTimeout = useRef<NodeJS.Timeout>()
  const stopTimeout = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!conversationId || !otherUserId) return
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_indicators',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          if ((payload.old as any).user_id === otherUserId) setIsOtherTyping(false)
          return
        }
        const row = payload.new as any
        if (row.user_id === otherUserId) {
          setIsOtherTyping(true)
          clearTimeout(stopTimeout.current)
          stopTimeout.current = setTimeout(() => setIsOtherTyping(false), 4000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, otherUserId])

  const sendTyping = useCallback(async () => {
    if (!profile || !conversationId) return
    clearTimeout(typingTimeout.current)
    await supabase.from('typing_indicators').upsert({
      conversation_id: conversationId,
      user_id: profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id,user_id' })
    typingTimeout.current = setTimeout(async () => {
      await supabase.from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', profile.id)
    }, 3000)
  }, [profile, conversationId])

  const stopTyping = useCallback(async () => {
    if (!profile || !conversationId) return
    clearTimeout(typingTimeout.current)
    await supabase.from('typing_indicators')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', profile.id)
  }, [profile, conversationId])

  return { isOtherTyping, sendTyping, stopTyping }
}
