'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useChatStore } from '@/store/chat'
import type { DirectMessage } from '@/types/database'

export function useMessages(conversationId: string) {
  const { setMessages, addMessage } = useChatStore()

  useEffect(() => {
    if (!conversationId) return

    // Fetch last 50 messages initially
    supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(conversationId, data.reverse())
      })

    // Track blocked users for this conversation
    let blockedIds: string[] = []
    supabase.from('blocks' as any).select('blocked_id')
      .then(({ data }) => { if (data) blockedIds = data.map((b: any) => b.blocked_id) })

    const channel = supabase
      .channel(`messages:${conversationId}:${Math.random()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        addMessage(conversationId, payload.new as DirectMessage)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        // Update message in store (handles read_at, edited_at, deleted_at)
        useChatStore.setState((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || [])
              .filter(m => !payload.new.deleted_at || m.id !== payload.new.id)
              .map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m),
          },
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])
}
