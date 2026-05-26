'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { playMessageSound, playMentionSound } from '@/lib/notificationSound'
import { X } from 'lucide-react'

interface Toast {
  id: string
  username: string
  avatar?: string
  message: string
  conversationId?: string
  type: 'dm' | 'mention'
  timestamp: number
}

export default function ToastNotification() {
  const { profile } = useAuthStore()
  const { activeConversation, setActiveConversation, conversations } = useChatStore()
  const [toasts, setToasts] = useState<Toast[]>([])
  const activeConvRef = useRef(activeConversation)
  const conversationsRef = useRef(conversations)
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => { activeConvRef.current = activeConversation }, [activeConversation])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  const pushToast = (toast: Toast) => {
    setToasts(prev => [...prev.filter(t => t.id !== toast.id).slice(-2), toast])
    if (timers.current.has(toast.id)) clearTimeout(timers.current.get(toast.id)!)
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
      timers.current.delete(toast.id)
    }, 4500)
    timers.current.set(toast.id, timer)
  }

  useEffect(() => {
    if (!profile) return

    // DM messages - no filter, catch everything then check
    const dmSub = supabase
      .channel(`toast_dm:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages',
      }, async (payload) => {
        const msg = payload.new as any
        // Not our message
        if (msg.sender_id === profile.id) return
        // Not viewing this conversation right now
        if (activeConvRef.current?.id === msg.conversation_id) return

        // Skip if sender is blocked
        const { data: blk } = await (supabase as any).from('blocks')
          .select('id').eq('blocker_id', profile.id).eq('blocked_id', msg.sender_id)
        if (blk && blk.length > 0) return

        const { data: sender } = await supabase
          .from('profiles').select('username, avatar_url').eq('id', msg.sender_id).single()

        playMessageSound()
        // Show OS notification if window not focused
        if (document.visibilityState === 'hidden' || !document.hasFocus()) {
          if (Notification.permission === 'granted') {
            new Notification(sender?.username ?? 'Arke', {
              body: msg.content ? msg.content.slice(0, 80) : '🎤 Sesli mesaj',
              icon: sender?.avatar_url || '/arke-logo.png',
              tag: 'dm-' + msg.conversation_id,
            })
          }
        }
        pushToast({
          id: msg.id,
          username: sender?.username ?? '?',
          avatar: sender?.avatar_url,
          message: msg.content
            ? msg.content.slice(0, 55) + (msg.content.length > 55 ? '...' : '')
            : (msg as any).voice_duration ? '🎤 Sesli mesaj' : '📷 Görsel',
          conversationId: msg.conversation_id,
          type: 'dm',
          timestamp: Date.now(),
        })
      })
      .subscribe()

    // Channel mentions
    const mentionSub = supabase
      .channel(`toast_mention:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'channel_messages',
      }, async (payload) => {
        const msg = payload.new as any
        if (msg.sender_id === profile.id) return
        if (!msg.content?.includes(`@${profile.username}`)) return

        const { data: sender } = await supabase
          .from('profiles').select('username, avatar_url').eq('id', msg.sender_id).single()

        playMentionSound()
        pushToast({
          id: msg.id,
          username: sender?.username ?? '?',
          avatar: sender?.avatar_url,
          message: `Seni mention etti: ${msg.content.slice(0, 45)}`,
          type: 'mention',
          timestamp: Date.now(),
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(dmSub)
      supabase.removeChannel(mentionSub)
      timers.current.forEach(t => clearTimeout(t))
    }
  }, [profile?.id])

  const handleClick = (toast: Toast) => {
    if (toast.conversationId) {
      // Find conversation in current ref
      const conv = conversationsRef.current.find(c => c.id === toast.conversationId)
      if (conv) setActiveConversation(conv)
    }
    dismiss(toast.id)
  }

  const dismiss = (id: string) => {
    if (timers.current.has(id)) { clearTimeout(timers.current.get(id)!); timers.current.delete(id) }
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl pointer-events-auto"
          style={{
            background: 'rgba(20,20,36,0.98)',
            border: `1px solid ${toast.type === 'mention' ? 'rgba(255,107,157,0.35)' : 'rgba(192,68,255,0.3)'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            minWidth: 280, maxWidth: 340,
            cursor: toast.conversationId ? 'pointer' : 'default',
            animation: 'slideInRight 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onClick={() => handleClick(toast)}>
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
            {toast.avatar
              ? <img src={toast.avatar} alt="" className="w-full h-full object-cover" />
              : toast.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-sm font-semibold truncate" style={{ color: '#f0eeff' }}>{toast.username}</p>
              {toast.type === 'mention' && (
                <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(255,107,157,0.15)', color: '#ff6b9d', fontSize: 9, fontWeight: 700 }}>
                  MENTION
                </span>
              )}
            </div>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{toast.message}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); dismiss(toast.id) }}
            style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 4 }}>
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%) scale(0.9); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
