import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export interface NotificationItem {
  id: string
  server_id?: string
  channel_id?: string
  type: string
  read: boolean
  created_at: string
  server?: { name: string; icon_url?: string }
}

export function useNotifications() {
  const { profile } = useAuthStore()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const serverCounts: Record<string, number> = {}
  notifications.filter(n => !n.read && n.server_id).forEach(n => {
    serverCounts[n.server_id!] = (serverCounts[n.server_id!] || 0) + 1
  })

  const fetchNotifications = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*, server:servers(name, icon_url)')
      .eq('user_id', profile.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifications(data as any)
  }, [profile?.id])

  useEffect(() => {
    fetchNotifications()
    if (!profile) return
    const channel = supabase
      .channel(`notifs:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => fetchNotifications())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, fetchNotifications])

  const markRead = async (serverId?: string) => {
    if (!profile) return
    let query = (supabase.from('notifications') as any).update({ read: true }).eq('user_id', profile.id)
    if (serverId) query = query.eq('server_id', serverId)
    await query
    fetchNotifications()
  }

  return { notifications, serverCounts, markRead, fetchNotifications }
}

// Helper: send notification to all server members except sender
export async function notifyServerMembers(
  serverId: string,
  channelId: string,
  senderId: string,
  messageId: string,
  type: 'message' | 'mention',
  mentionedUserId?: string
) {
  if (type === 'mention' && mentionedUserId) {
    await supabase.from('notifications').insert({
      user_id: mentionedUserId, server_id: serverId,
      channel_id: channelId, message_id: messageId, type: 'mention'
    })
    return
  }

  // Get all members except sender
  const { data: members } = await supabase
    .from('server_members')
    .select('user_id')
    .eq('server_id', serverId)
    .neq('user_id', senderId)

  if (!members || members.length === 0) return

  await supabase.from('notifications').insert(
    members.map(m => ({
      user_id: m.user_id, server_id: serverId,
      channel_id: channelId, message_id: messageId, type: 'message'
    }))
  )
}
