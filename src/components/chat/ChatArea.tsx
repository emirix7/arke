'use client'
import { Phone, Paperclip, Send, Pencil, Trash2, Check, X, Mic } from 'lucide-react'
import { LinkText } from '@/components/ui/LinkPreview'
import VoiceMessageRecorder from '@/components/ui/VoiceMessageRecorder'
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
import type { DirectMessage } from '@/types/database'

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥']

interface ChatAreaProps { globalMicMuted?: boolean }

export default function ChatArea({ globalMicMuted }: ChatAreaProps) {
  const { profile } = useAuthStore()
  const { activeConversation, messages } = useChatStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const prevLengthRef = useRef(0)
  const convId = activeConversation?.id ?? ''
  const other = activeConversation?.other_user

  useMessages(convId)
  const { startCall } = useVoiceCall(other?.id ?? '')
  const { isOtherTyping, sendTyping, stopTyping } = useTyping(convId, other?.id ?? '')
  const { reactions, toggleReaction, fetchReactions } = useReactions(convId)

  const convMessages = messages[convId] ?? []

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [convMessages.length, isOtherTyping])

  useEffect(() => {
    const msgs = messages[convId] ?? []
    if (msgs.length > prevLengthRef.current && prevLengthRef.current > 0) {
      const last = msgs[msgs.length - 1]
      if (last.sender_id !== profile?.id) playMessageSound()
    }
    prevLengthRef.current = msgs.length
  }, [convMessages.length])

  useEffect(() => {
    convMessages.forEach(m => { if (!reactions[m.id]) fetchReactions(m.id) })
  }, [convMessages.length])

  useEffect(() => {
    if (!convId || !profile) return
    ;(supabase.from('direct_messages') as any)
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .neq('sender_id', profile.id)
      .is('read_at', null)
  }, [convId, convMessages.length])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setImageFile(f); setImagePreview(URL.createObjectURL(f))
  }

  const sendMessage = async () => {
    if ((!input.trim() && !imageFile) || !profile || !activeConversation) return
    setSending(true)
    const content = input.trim()
    setInput(''); stopTyping()
    let image_url = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const { data } = await supabase.storage.from('messages').upload(`${profile.id}/${Date.now()}.${ext}`, imageFile, { upsert: true })
      if (data) image_url = supabase.storage.from('messages').getPublicUrl(data.path).data.publicUrl
      setImageFile(null); setImagePreview('')
    }
    await (supabase.from('direct_messages') as any).insert({ conversation_id: convId, sender_id: profile.id, content: content || null, image_url })
    setSending(false)
  }

  const sendVoiceMessage = async (blob: Blob, duration: number) => {
    if (!profile || !activeConversation) return
    setShowVoiceRecorder(false)
    const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
    const { data } = await supabase.storage.from('messages').upload(`${profile.id}/${file.name}`, file, { upsert: true })
    if (data) {
      const url = supabase.storage.from('messages').getPublicUrl(data.path).data.publicUrl
      await (supabase.from('direct_messages') as any).insert({
        conversation_id: convId, sender_id: profile.id,
        content: null, image_url: url, voice_duration: duration
      })
    }
  }

  const deleteMessage = async (msgId: string) => {
    await (supabase.from('direct_messages') as any).update({ deleted_at: new Date().toISOString() }).eq('id', msgId)
  }

  const editMessage = async (msgId: string, newContent: string) => {
    await (supabase.from('direct_messages') as any).update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', msgId)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (e.target.value) sendTyping(); else stopTyping()
  }

  const grouped = groupMessages(convMessages.filter(m => !(m as any).deleted_at))
  const lastSeen = other?.status !== 'online' && (other as any)?.updated_at
    ? formatDistanceToNow(new Date((other as any).updated_at), { addSuffix: true, locale: tr }) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: '#0d0d14' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="relative">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
            {other?.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" /> : (other?.username ?? '').slice(0, 2).toUpperCase()}
          </div>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{ background: other?.status === 'online' ? '#3dff9a' : '#555', border: '2px solid #0d0d14' }} />
        </div>
        <div className="flex-1">
          <p className="font-syne font-semibold text-sm" style={{ color: '#f0eeff' }}>{other?.username}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {isOtherTyping ? <span style={{ color: '#c044ff' }}>yazıyor...</span>
              : lastSeen ? `Son görülme ${lastSeen}` : other?.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
          </p>
        </div>
        <button onClick={startCall}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{ background: 'rgba(61,255,154,0.08)', border: '1px solid rgba(61,255,154,0.15)', color: '#3dff9a' }}>
          <Phone size={15} strokeWidth={2} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
        {grouped.map((group, gi) => (
          <MessageGroup key={gi} group={group} currentUserId={profile?.id ?? ''}
            reactions={reactions} onReact={toggleReaction}
            onDelete={deleteMessage} onEdit={editMessage}
            otherUser={other} currentUser={profile} />
        ))}
        {isOtherTyping && (
          <div className="flex items-end gap-2 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
              {(other?.username ?? '').slice(0, 2).toUpperCase()}
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#c044ff', animation: `pulse-dot 1s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {imagePreview && (
        <div className="px-5 pb-2 flex-shrink-0">
          <div className="relative inline-block">
            <img src={imagePreview} alt="" className="rounded-xl object-cover" style={{ maxHeight: 100, maxWidth: 180 }} />
            <button onClick={() => { setImageFile(null); setImagePreview('') }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#ff6b9d', color: 'white' }}>
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* Voice recorder */}
      {showVoiceRecorder && (
        <div className="px-5 pb-2 flex-shrink-0">
          <VoiceMessageRecorder
            onSend={sendVoiceMessage}
            onCancel={() => setShowVoiceRecorder(false)} />
        </div>
      )}

      {/* Input */}
      <div className="px-5 pb-4 pt-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 flex items-center justify-center transition-all"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Paperclip size={16} strokeWidth={1.75} />
          </button>
          <input ref={fileRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleImageSelect} />
          <input className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
            placeholder={`${other?.username ?? ''} kişisine mesaj yaz...`}
            value={input} onChange={handleInput} onKeyDown={handleKey} onBlur={() => stopTyping()} />
          <div className="flex items-center gap-1 flex-shrink-0">
            <EmojiPickerBtn onEmoji={emoji => setInput(p => p + emoji)} />
            {!input.trim() && !imageFile && (
              <button onClick={() => setShowVoiceRecorder(true)}
                className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Mic size={15} strokeWidth={1.75} />
              </button>
            )}
            <button onClick={sendMessage} disabled={(!input.trim() && !imageFile) || sending}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: (input.trim() || imageFile) ? 'linear-gradient(135deg, #c044ff, #00d4ff)' : 'rgba(255,255,255,0.05)',
                color: (input.trim() || imageFile) ? 'white' : 'rgba(255,255,255,0.3)',
                border: 'none', cursor: (input.trim() || imageFile) ? 'pointer' : 'not-allowed',
              }}>
              <Send size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageGroup({ group, currentUserId, reactions, onReact, onDelete, onEdit, otherUser, currentUser }: {
  group: DirectMessage[]; currentUserId: string
  reactions: Record<string, any[]>; onReact: (id: string, emoji: string) => void
  onDelete: (id: string) => void; onEdit: (id: string, content: string) => void
  otherUser?: any; currentUser?: any
}) {
  const isOwn = group[0].sender_id === currentUserId
  const lastMsg = group[group.length - 1]
  const isRead = lastMsg.read_at !== null
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const startEdit = (msg: DirectMessage) => {
    setEditingId(msg.id)
    setEditText(msg.content ?? '')
  }

  const submitEdit = async (msgId: string) => {
    if (editText.trim()) await onEdit(msgId, editText.trim())
    setEditingId(null)
  }

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} gap-0.5 mb-2`}>
      {group.map((msg, i) => {
        const msgReactions = reactions[msg.id] ?? []
        const isEditing = editingId === msg.id
        return (
          <div key={msg.id} className="relative w-full"
            onMouseEnter={() => setHoveredMsg(msg.id)}
            onMouseLeave={() => setHoveredMsg(null)}>
            <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 h-7 flex-shrink-0">
                {!isOwn && i === group.length - 1 && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
                    {otherUser?.avatar_url
                      ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (otherUser?.username ?? '').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ maxWidth: 380 }}>
                {(msg as any).image_url && (
                  (msg as any).image_url.includes('.webm') ? (
                    <audio controls src={(msg as any).image_url} className="rounded-xl mb-1" style={{ maxWidth: 280 }} />
                  ) : (
                    <img src={(msg as any).image_url} alt="" className="rounded-xl mb-1 cursor-pointer"
                      style={{ maxWidth: 280, maxHeight: 280, objectFit: 'cover', display: 'block' }}
                      onClick={() => window.open((msg as any).image_url, '_blank')} />
                  )
                )}
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input value={editText} onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitEdit(msg.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(192,68,255,0.4)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif', minWidth: 200 }}
                      autoFocus />
                    <button onClick={() => submitEdit(msg.id)} style={{ color: '#3dff9a' }}><Check size={14} strokeWidth={2.5} /></button>
                    <button onClick={() => setEditingId(null)} style={{ color: '#ff6b9d' }}><X size={14} strokeWidth={2.5} /></button>
                  </div>
                ) : msg.content ? (
                  <div className="px-3.5 py-2.5 text-sm leading-relaxed"
                    style={{
                      background: isOwn ? 'linear-gradient(135deg, rgba(192,68,255,0.65), rgba(0,212,255,0.45))' : 'rgba(255,255,255,0.07)',
                      color: isOwn ? 'white' : '#e8e6f0',
                      borderRadius: isOwn ? (i === 0 ? '18px 18px 4px 18px' : '18px 4px 4px 18px') : (i === 0 ? '18px 18px 18px 4px' : '4px 18px 18px 4px'),
                    }}>
                    <LinkText content={msg.content ?? ''} />
                    {(msg as any).edited_at && (
                      <span className="ml-1 text-xs opacity-50">(düzenlendi)</span>
                    )}
                  </div>
                ) : null}
                {msgReactions.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {msgReactions.map(r => (
                      <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs"
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

              {/* Action toolbar on hover */}
              {hoveredMsg === msg.id && !isEditing && (
                <div className={`absolute ${isOwn ? 'right-10' : 'left-10'} -top-8 flex items-center gap-1 px-2 py-1 rounded-xl z-10`}
                  style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {QUICK_REACTIONS.map(emoji => (
                    <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                      className="text-base hover:scale-125 transition-transform duration-100 w-6 h-6 flex items-center justify-center">
                      {emoji}
                    </button>
                  ))}
                  {isOwn && msg.content && (
                    <button onClick={() => startEdit(msg)}
                      className="w-6 h-6 flex items-center justify-center rounded ml-1 transition-all"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c044ff'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'}>
                      <Pencil size={12} strokeWidth={2} />
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => onDelete(msg.id)}
                      className="w-6 h-6 flex items-center justify-center rounded transition-all"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ff6b9d'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'}>
                      <Trash2 size={12} strokeWidth={2} />
                    </button>
                  )}
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
  const groups: DirectMessage[][] = []; let cur: DirectMessage[] = []
  for (const msg of msgs) {
    if (cur.length === 0 || (cur[0].sender_id === msg.sender_id &&
      new Date(msg.created_at).getTime() - new Date(cur[cur.length - 1].created_at).getTime() < 120000)) {
      cur.push(msg)
    } else { groups.push(cur); cur = [msg] }
  }
  if (cur.length > 0) groups.push(cur)
  return groups
}
