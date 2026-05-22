'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { useMessages } from '@/hooks/useMessages'
import { useVoiceCall } from '@/hooks/useVoiceCall'
import { useTyping } from '@/hooks/useTyping'
import { useReactions } from '@/hooks/useReactions'
import { playMessageSound } from '@/lib/notificationSound'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import EmojiPickerBtn from './EmojiPickerBtn'
import VoiceCallOverlay from './VoiceCallOverlay'
import type { DirectMessage } from '@/types/database'

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥']

interface ChatAreaProps { globalMicMuted?: boolean }

export default function ChatArea({ globalMicMuted }: ChatAreaProps) {
  const { profile } = useAuthStore()
  const { activeConversation, messages } = useChatStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)
  const convId = activeConversation?.id ?? ''
  const other = activeConversation?.other_user

  useMessages(convId)
  const { callState, startCall, acceptCall, declineCall, endCall, toggleMute, toggleDeafen } =
    useVoiceCall(other?.id ?? '')
  const { isOtherTyping, sendTyping, stopTyping } = useTyping(convId, other?.id ?? '')
  const { reactions, toggleReaction, fetchReactions } = useReactions(convId)

  const convMessages = messages[convId] ?? []

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convMessages.length, isOtherTyping])

  // Play sound on new incoming message
  useEffect(() => {
    const msgs = messages[convId] ?? []
    if (msgs.length > prevLengthRef.current && prevLengthRef.current > 0) {
      const last = msgs[msgs.length - 1]
      if (last.sender_id !== profile?.id) playMessageSound()
    }
    prevLengthRef.current = msgs.length
  }, [convMessages.length])

  // Fetch reactions for visible messages
  useEffect(() => {
    convMessages.forEach(m => { if (!reactions[m.id]) fetchReactions(m.id) })
  }, [convMessages.length])

  // Mark as read
  useEffect(() => {
    if (!convId || !profile) return
    supabase.from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .neq('sender_id', profile.id)
      .is('read_at', null)
  }, [convId, convMessages.length])

  const sendMessage = async () => {
    if (!input.trim() || !profile || !activeConversation) return
    setSending(true)
    const content = input.trim()
    setInput('')
    stopTyping()
    await supabase.from('direct_messages').insert({
      conversation_id: convId,
      sender_id: profile.id,
      content,
    })
    setSending(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (e.target.value) sendTyping()
    else stopTyping()
  }

  const grouped = groupMessages(convMessages)

  // Last seen
  const lastMsg = convMessages[convMessages.length - 1]
  const lastSeen = other?.status !== 'online' && other?.updated_at
    ? formatDistanceToNow(new Date(other.updated_at), { addSuffix: true, locale: tr })
    : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: '#0d0d14' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="relative">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
            {other?.avatar_url
              ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
              : (other?.username ?? '').slice(0, 2).toUpperCase()}
          </div>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{ background: other?.status === 'online' ? '#3dff9a' : '#555', border: '2px solid #0d0d14' }} />
        </div>
        <div className="flex-1">
          <p className="font-syne font-semibold text-sm" style={{ color: '#f0eeff' }}>{other?.username}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {isOtherTyping ? (
              <span style={{ color: '#c044ff' }}>yazıyor...</span>
            ) : lastSeen ? `Son görülme ${lastSeen}` : other?.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
          </p>
        </div>
        <button onClick={startCall}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(61,255,154,0.08)', border: '1px solid rgba(61,255,154,0.15)', fontSize: 14 }}
          title="Sesli Ara">📞</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
        {grouped.map((group, gi) => (
          <MessageGroup
            key={gi}
            group={group}
            currentUserId={profile?.id ?? ''}
            reactions={reactions}
            onReact={toggleReaction}
          />
        ))}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex items-end gap-2 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
              {(other?.username ?? '').slice(0, 2).toUpperCase()}
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: '#c044ff',
                    animation: `pulse-dot 1s ease-in-out ${i * 0.2}s infinite`,
                  }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 pb-4 pt-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
            placeholder={`${other?.username ?? ''} kişisine mesaj yaz...`}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            onBlur={() => stopTyping()}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <EmojiPickerBtn onEmoji={(emoji) => setInput(p => p + emoji)} />
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: input.trim() ? 'linear-gradient(135deg, #c044ff, #00d4ff)' : 'rgba(255,255,255,0.05)',
                fontSize: 13, cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}>➤</button>
          </div>
        </div>
      </div>

      {callState.active && (
        <VoiceCallOverlay
          roomName={callState.roomName}
          token={callState.token}
          status={callState.status}
          currentUser={profile}
          otherUser={other}
          isIncoming={callState.isIncoming}
          callerProfile={callState.callerProfile}
          onEnd={endCall}
          onAccept={acceptCall}
          onDecline={declineCall}
          muted={callState.muted || (globalMicMuted ?? false)}
          deafened={callState.deafened}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
        />
      )}
    </div>
  )
}

function MessageGroup({ group, currentUserId, reactions, onReact }: {
  group: DirectMessage[]
  currentUserId: string
  reactions: Record<string, any[]>
  onReact: (msgId: string, emoji: string) => void
}) {
  const isOwn = group[0].sender_id === currentUserId
  const lastMsg = group[group.length - 1]
  const isRead = lastMsg.read_at !== null
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} gap-0.5 mb-2`}>
      {group.map((msg, i) => {
        const msgReactions = reactions[msg.id] ?? []
        return (
          <div key={msg.id} className="relative group">
            <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
              onMouseEnter={() => setHoveredMsg(msg.id)}
              onMouseLeave={() => setHoveredMsg(null)}>
              <div className="w-7 h-7 flex-shrink-0">
                {!isOwn && i === group.length - 1 && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
                    {group[0].sender_id.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div style={{ maxWidth: 380 }}>
                <div className="px-3.5 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: isOwn
                      ? 'linear-gradient(135deg, rgba(192,68,255,0.65), rgba(0,212,255,0.45))'
                      : 'rgba(255,255,255,0.07)',
                    color: isOwn ? 'white' : '#e8e6f0',
                    borderRadius: isOwn
                      ? (i === 0 ? '18px 18px 4px 18px' : '18px 4px 4px 18px')
                      : (i === 0 ? '18px 18px 18px 4px' : '4px 18px 18px 4px'),
                  }}>
                  {msg.content}
                </div>

                {/* Reactions display */}
                {msgReactions.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {msgReactions.map(r => (
                      <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs transition-all duration-150"
                        style={{
                          background: r.userReacted ? 'rgba(192,68,255,0.2)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${r.userReacted ? 'rgba(192,68,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                        <span>{r.emoji}</span>
                        <span style={{ color: r.userReacted ? '#c044ff' : 'rgba(255,255,255,0.5)' }}>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick reaction bar on hover */}
              {hoveredMsg === msg.id && (
                <div
                  className={`absolute ${isOwn ? 'right-10' : 'left-10'} -top-8 flex items-center gap-1 px-2 py-1 rounded-xl z-10`}
                  style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {QUICK_REACTIONS.map(emoji => (
                    <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                      className="text-base hover:scale-125 transition-transform duration-100 w-6 h-6 flex items-center justify-center">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <div className="flex items-center gap-1 mt-0.5 px-9 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        <span>{format(new Date(lastMsg.created_at), 'HH:mm')}</span>
        {isOwn && <span style={{ color: isRead ? '#00d4ff' : 'rgba(255,255,255,0.2)' }}>{isRead ? ' ✓✓' : ' ✓'}</span>}
      </div>
    </div>
  )
}

function groupMessages(msgs: DirectMessage[]): DirectMessage[][] {
  const groups: DirectMessage[][] = []
  let cur: DirectMessage[] = []
  for (const msg of msgs) {
    if (cur.length === 0 || (cur[0].sender_id === msg.sender_id &&
      new Date(msg.created_at).getTime() - new Date(cur[cur.length - 1].created_at).getTime() < 120000)) {
      cur.push(msg)
    } else { groups.push(cur); cur = [msg] }
  }
  if (cur.length > 0) groups.push(cur)
  return groups
}
