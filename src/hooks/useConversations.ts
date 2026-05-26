'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import type { ConversationWithProfile } from '@/types/database'

export function useConversations() {
  const { profile } = useAuthStore()
  const { setConversations } = useChatStore()

  useEffect(() => {
    if (!profile) return

    const fetchConversations = async () => {
      // Get blocked user IDs first
      const { data: blocksData } = await supabase
        .from('blocks' as any)
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`)

      const blockedIds = new Set<string>()
      if (blocksData) {
        blocksData.forEach((b: any) => {
          if (b.blocker_id === profile.id) blockedIds.add(b.blocked_id)
          if (b.blocked_id === profile.id) blockedIds.add(b.blocker_id)
        })
      }

      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          p1:profiles!conversations_participant_1_fkey(*),
          p2:profiles!conversations_participant_2_fkey(*)
        `)
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (!data) return

      const convs: ConversationWithProfile[] = data
        .map((conv: Record<string, unknown>) => ({
          ...(conv as ConversationWithProfile),
          other_user: (conv.participant_1 as string) === profile.id
            ? (conv.p2 as ConversationWithProfile['other_user'])
            : (conv.p1 as ConversationWithProfile['other_user']),
        }))
        // Filter out blocked users
        .filter(conv => !blockedIds.has(conv.other_user.id))

      const withUnread = await Promise.all(
        convs.map(async (conv) => {
          const { count } = await supabase
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', profile.id)
            .is('read_at', null)
          return { ...conv, unread_count: count ?? 0 }
        })
      )

      setConversations(withUnread)
    }

    fetchConversations()

    const channel = supabase
      .channel(`conversations_updates:${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'direct_messages',
      }, fetchConversations)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'blocks',
      }, fetchConversations)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])
}
