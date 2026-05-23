'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'

export function useRealtimeUpdates() {
  const { profile, fetchProfile, user } = useAuthStore()
  const { conversations, setConversations } = useChatStore()

  useEffect(() => {
    if (!profile) return

    // Listen for profile updates (others changing their avatar, status, etc)
    const profileChannel = supabase
      .channel('realtime_profiles')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
      }, (payload) => {
        const updated = payload.new as any
        // Update in conversations list
        useChatStore.setState(state => ({
          conversations: state.conversations.map(c =>
            c.other_user.id === updated.id
              ? { ...c, other_user: { ...c.other_user, ...updated } }
              : c
          )
        }))
        // If it's our own profile, update auth store
        if (updated.id === profile.id && user) fetchProfile(user.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(profileChannel) }
  }, [profile?.id])
}
