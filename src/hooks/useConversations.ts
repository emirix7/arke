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

      const convs: ConversationWithProfile[] = data.map((conv: Record<string, unknown>) => ({
        ...(conv as ConversationWithProfile),
        other_user: (conv.participant_1 as string) === profile.id
          ? (conv.p2 as ConversationWithProfile['other_user'])
          : (conv.p1 as ConversationWithProfile['other_user']),
      }))

      // Fetch unread counts
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

    // Realtime: new messages update last_message_at
    const channel = supabase
      .channel('conversations_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
      }, fetchConversations)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])
}
