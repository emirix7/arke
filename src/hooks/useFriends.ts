import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { FriendWithProfile } from '@/types/database'

export function useFriendRequests() {
  const { profile } = useAuthStore()
  const [pending, setPending] = useState<FriendWithProfile[]>([])
  const [sent, setSent] = useState<FriendWithProfile[]>([])
  const [friends, setFriends] = useState<FriendWithProfile[]>([])

  const refetch = useCallback(async () => {
    if (!profile) return

    // Incoming pending
    const { data: pendingData } = await supabase
      .from('friendships')
      .select('*, profile:profiles!friendships_sender_id_fkey(*)')
      .eq('receiver_id', profile.id)
      .eq('status', 'pending')

    // Accepted friends
    const { data: friendsData } = await supabase
      .from('friendships')
      .select('*, profile:profiles!friendships_receiver_id_fkey(*)')
      .eq('sender_id', profile.id)
      .eq('status', 'accepted')

    const { data: friendsData2 } = await supabase
      .from('friendships')
      .select('*, profile:profiles!friendships_sender_id_fkey(*)')
      .eq('receiver_id', profile.id)
      .eq('status', 'accepted')

    setPending((pendingData as unknown as FriendWithProfile[]) ?? [])
    setFriends([
      ...((friendsData as unknown as FriendWithProfile[]) ?? []),
      ...((friendsData2 as unknown as FriendWithProfile[]) ?? []),
    ])
  }, [profile?.id])

  useEffect(() => { refetch() }, [refetch])

  const pendingCount = pending.length

  return { pending, sent, friends, refetch, pendingCount }
}
