import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useChatStore } from '@/store/chat'
import type { DirectMessage } from '@/types/database'

export function useMessages(conversationId: string) {
  const { setMessages, addMessage } = useChatStore()

  useEffect(() => {
    if (!conversationId) return

    // Fetch existing messages
    supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(conversationId, data)
      })

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          addMessage(conversationId, payload.new as DirectMessage)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Update read_at on existing messages
          useChatStore.setState((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: (state.messages[conversationId] || []).map((m) =>
                m.id === payload.new.id ? { ...m, ...payload.new } : m
              ),
            },
          }))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])
}
