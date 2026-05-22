import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export interface Reaction {
  emoji: string
  count: number
  userReacted: boolean
}

export function useReactions(conversationId: string) {
  const { profile } = useAuthStore()
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({})

  const fetchReactions = useCallback(async (msgId: string) => {
    const { data } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', msgId)
    if (!data) return
    const grouped: Record<string, { count: number; userReacted: boolean }> = {}
    data.forEach(r => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, userReacted: false }
      grouped[r.emoji].count++
      if (r.user_id === profile?.id) grouped[r.emoji].userReacted = true
    })
    const list: Reaction[] = Object.entries(grouped).map(([emoji, v]) => ({ emoji, ...v }))
    setReactions(prev => ({ ...prev, [msgId]: list }))
  }, [profile?.id])

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!profile) return
    const existing = reactions[messageId]?.find(r => r.emoji === emoji && r.userReacted)
    if (existing) {
      await supabase.from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', profile.id)
        .eq('emoji', emoji)
    } else {
      await supabase.from('message_reactions')
        .insert({ message_id: messageId, user_id: profile.id, emoji })
    }
    await fetchReactions(messageId)
  }, [profile, reactions, fetchReactions])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
      }, (payload) => {
        const msgId = (payload.new as any)?.message_id || (payload.old as any)?.message_id
        if (msgId) fetchReactions(msgId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, fetchReactions])

  return { reactions, toggleReaction, fetchReactions }
}
