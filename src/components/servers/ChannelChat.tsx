'use client'
import { Paperclip, Send, Pencil, Trash2, Check, X, Reply } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useServerStore } from '@/store/server'
import { useTyping } from '@/hooks/useTyping'
import { playMessageSound } from '@/lib/notificationSound'
import { notifyServerMembers } from '@/hooks/useNotifications'
import { format } from 'date-fns'
import EmojiPickerBtn from '@/components/chat/EmojiPickerBtn'
import ReplyBar from '@/components/chat/ReplyBar'
import type { ChannelMessage } from '@/types/server'

export default function ChannelChat() {
  const { profile } = useAuthStore()
  const { activeChannel, activeServer, messages, setMessages, addMessage, deleteMessage, members } = useServerStore()
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; username: string } | null>(null)
  const [mentionSearch, setMentionSearch] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevLenRef = useRef(0)
  const channelId = activeChannel?.id ?? ''
  const otherUserIds = members.filter((m: any) => m.user_id !== profile?.id).map((m: any) => m.user_id)
  const convMessages = messages[channelId] ?? []
  const { isOtherTyping: isTyping, sendTyping, stopTyping } = useTyping(channelId, otherUserIds[0] ?? '')

  // Get current user's role
  const myMember = members.find((m: any) => m.user_id === profile?.id) as any
  const myRole = myMember?.role || (activeServer?.owner_id === profile?.id ? 'admin' : 'user')
  const canDeleteAll = myRole === 'admin' || myRole === 'mod'

  const mentionMembers = members.filter((m: any) =>
    m.profile?.username?.toLowerCase().includes(mentionSearch.toLowerCase()) && m.user_id !== profile?.id
  ).slice(0, 6)

  useEffect(() => {
    if (!channelId) return
    fetchMessages()
    setTimeout(() => inputRef.current?.focus(), 150)
    prevLenRef.current = 0
    const channel = supabase.channel(`ch_msgs:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const msg = payload.new as any
          const { data: p } = await supabase.from('profiles').select('username, avatar_url').eq('id', msg.sender_id).single()
          addMessage(channelId, { ...msg, profile: p })
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (payload.new.deleted_at) {
            deleteMessage(channelId, payload.new.id)
          } else {
            // Update edited message
            useServerStore.setState(state => ({
              messages: {
                ...state.messages,
                [channelId]: (state.messages[channelId] || []).map(m =>
                  m.id === payload.new.id ? { ...m, content: payload.new.content, edited_at: payload.new.edited_at } : m
                )
              }
            }))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    const msgs = messages[channelId] ?? []
    if (msgs.length > prevLenRef.current && prevLenRef.current > 0) {
      const last = msgs[msgs.length - 1]
      if (last.sender_id !== profile?.id) playMessageSound()
    }
    prevLenRef.current = msgs.length
  }, [convMessages.length])

  const fetchMessages = async () => {
    const { data } = await supabase.from('channel_messages')
      .select('*, profile:profiles(username, avatar_url)')
      .eq('channel_id', channelId).is('deleted_at', null)
      .order('created_at', { ascending: true }).limit(100)
    if (data) setMessages(channelId, data as any)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setInput(val)
    if (val) sendTyping(); else stopTyping()
    const atMatch = val.match(/@(\w*)$/)
    if (atMatch) { setMentionSearch(atMatch[1]); setShowMentions(true); setMentionIndex(0) }
    else setShowMentions(false)
  }

  const insertMention = (username: string) => {
    setInput(prev => prev.replace(/@\w*$/, `@${username} `))
    setShowMentions(false); inputRef.current?.focus()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (showMentions && mentionMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionMembers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (mentionMembers[mentionIndex]) insertMention((mentionMembers[mentionIndex] as any).profile.username); return }
      if (e.key === 'Escape') { setShowMentions(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setImageFile(f); setImagePreview(URL.createObjectURL(f))
  }

  const sendMessage = async () => {
    if ((!input.trim() && !imageFile) || !profile || !activeChannel || !activeServer) return
    setSending(true)
    let image_url = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const { data } = await supabase.storage.from('messages').upload(`${profile.id}/${Date.now()}.${ext}`, imageFile, { upsert: true })
      if (data) image_url = supabase.storage.from('messages').getPublicUrl(data.path).data.publicUrl
      setImageFile(null); setImagePreview('')
    }
    const content = input.trim()
    const { data: newMsg } = await (supabase.from('channel_messages') as any).insert({
      channel_id: channelId, sender_id: profile.id, content: content || null, image_url,
      reply_to_id: replyTo?.id ?? null,
      reply_preview: replyTo ? `@${replyTo.username}: ${replyTo.content?.slice(0, 80)}` : null
    }).select().single()
    setReplyTo(null)
    if (newMsg) {
      const mentionRegex = /@(\w+)/g; let match
      while ((match = mentionRegex.exec(content)) !== null) {
        const m = members.find((mb: any) => mb.profile?.username === match![1]) as any
        if (m && m.user_id !== profile.id) await notifyServerMembers(activeServer.id, channelId, profile.id, newMsg.id, 'mention', m.user_id)
      }
      await notifyServerMembers(activeServer.id, channelId, profile.id, newMsg.id, 'message')
    }
    setInput(''); setShowMentions(false); setSending(false); stopTyping()
  }

  const handleDelete = async (msgId: string) => {
    await (supabase.from('channel_messages') as any).update({ deleted_at: new Date().toISOString() }).eq('id', msgId)
    deleteMessage(channelId, msgId)
  }

  const handleEdit = async (msgId: string, newContent: string) => {
    await (supabase.from('channel_messages') as any).update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', msgId)
  }

  if (!activeChannel) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#0d0d14' }}>
      <p style={{ color: 'rgba(255,255,255,0.2)' }}>Bir kanal seç</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0d0d14' }}>
      <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>#</span>
        <p className="font-syne font-semibold text-sm" style={{ color: '#f0eeff' }}>{activeChannel.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {convMessages.filter(m => !m.deleted_at).map(msg => (
          <MessageItem key={msg.id} msg={msg} currentUserId={profile?.id ?? ''}
            canDelete={canDeleteAll || msg.sender_id === profile?.id}
            canEdit={msg.sender_id === profile?.id}
            onDelete={handleDelete} onEdit={handleEdit} />
        ))}
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

      {/* Typing indicator */}
      {isTyping && (
        <div className="mx-5 mb-1 flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#c044ff', animation: `pulse-dot 1s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
            <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>birisi yazıyor...</span>
          </div>
        </div>
      )}

      {showMentions && mentionMembers.length > 0 && (
        <div className="mx-5 mb-1 rounded-xl overflow-hidden flex-shrink-0"
          style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 -4px 16px rgba(0,0,0,0.3)' }}>
          {mentionMembers.map((m: any, i: number) => (
            <button key={m.user_id} onClick={() => insertMention(m.profile.username)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ background: i === mentionIndex ? 'rgba(192,68,255,0.12)' : 'transparent', color: '#e8e6f0' }}
              onMouseEnter={() => setMentionIndex(i)}>
              <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                {m.profile?.avatar_url ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" /> : m.profile?.username?.slice(0, 2).toUpperCase()}
              </div>
              <span className="font-medium">@{m.profile?.username}</span>
            </button>
          ))}
        </div>
      )}

      <ReplyBar replyTo={replyTo} onCancel={() => setReplyTo(null)} />

      <div className="px-5 pb-4 pt-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => fileRef.current?.click()}
            style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <Paperclip size={16} strokeWidth={1.75} />
          </button>
          <input ref={fileRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleImageSelect} />
          <input ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
            placeholder={`#${activeChannel.name} — @ ile mention yap`}
            value={input} onChange={handleInput} onKeyDown={handleKey} />
          <div className="flex items-center gap-1 flex-shrink-0">
            <EmojiPickerBtn onEmoji={emoji => setInput(p => p + emoji)} />
            <button onClick={sendMessage} disabled={(!input.trim() && !imageFile) || sending}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
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

function MessageItem({ msg, currentUserId, canDelete, canEdit, onDelete, onEdit }: {
  msg: ChannelMessage; currentUserId: string
  canDelete: boolean; canEdit: boolean
  onDelete: (id: string) => void; onEdit: (id: string, content: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const p = (msg as any).profile

  const startEdit = () => { setEditing(true); setEditText(msg.content ?? '') }
  const submitEdit = async () => { if (editText.trim()) await onEdit(msg.id, editText.trim()); setEditing(false) }

  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g)
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} style={{ color: '#c044ff', background: 'rgba(192,68,255,0.12)', borderRadius: 4, padding: '0 3px' }}>{part}</span>
        : part
    )
  }

  return (
    <div className="flex items-start gap-3 relative"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 mt-0.5"
        style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
        {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p?.username ?? '?').slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-semibold" style={{ color: '#e8e6f0' }}>{p?.username ?? 'Kullanıcı'}</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{format(new Date(msg.created_at), 'HH:mm')}</span>
          {(msg as any).edited_at && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>(düzenlendi)</span>}
        </div>
        {msg.reply_preview && (
          <div className="px-3 py-1.5 mb-1 rounded-xl text-xs"
            style={{ background: 'rgba(255,255,255,0.05)', borderLeft: '2px solid rgba(192,68,255,0.5)', color: 'rgba(255,255,255,0.45)' }}>
            {msg.reply_preview}
          </div>
        )}
        {editing ? (
          <div className="flex items-center gap-2">
            <input value={editText} onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false) }}
              className="flex-1 px-3 py-1.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(192,68,255,0.4)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
              autoFocus />
            <button onClick={submitEdit} style={{ color: '#3dff9a' }}><Check size={14} strokeWidth={2.5} /></button>
            <button onClick={() => setEditing(false)} style={{ color: '#ff6b9d' }}><X size={14} strokeWidth={2.5} /></button>
          </div>
        ) : (
          <>
            {msg.content && <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{renderContent(msg.content)}</p>}
            {msg.image_url && (
              <img src={msg.image_url} alt="" className="rounded-xl mt-1 cursor-pointer"
                style={{ maxWidth: 300, maxHeight: 300, objectFit: 'cover' }}
                onClick={() => window.open(msg.image_url!, '_blank')} />
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      {hover && !editing && (canDelete || canEdit) && (
        <div className="absolute right-0 top-0 flex items-center gap-1 px-2 py-1 rounded-xl"
          style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <button onClick={() => setReplyTo({ id: msg.id, content: msg.content ?? '', username: p?.username ?? '?' })}
              className="w-6 h-6 flex items-center justify-center rounded transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c044ff'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}>
              <Reply size={12} strokeWidth={2} />
            </button>
          {canEdit && msg.content && (
            <button onClick={startEdit}
              className="w-6 h-6 flex items-center justify-center rounded transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c044ff'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}>
              <Pencil size={12} strokeWidth={2} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(msg.id)}
              className="w-6 h-6 flex items-center justify-center rounded transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ff6b9d'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}>
              <Trash2 size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
