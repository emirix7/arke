'use client'
import { Phone, Paperclip, Send, Pencil, Trash2, Check, X, Mic, Reply, Copy, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { useMessages } from '@/hooks/useMessages'
import VoiceCallOverlay from '@/components/chat/VoiceCallOverlay'
import { useVoiceCall } from '@/hooks/useVoiceCall'
import { useTyping } from '@/hooks/useTyping'
import { useReactions } from '@/hooks/useReactions'
import { playMessageSound } from '@/lib/notificationSound'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import EmojiPickerBtn from './EmojiPickerBtn'
import ReplyBar from './ReplyBar'
import VoiceMessageRecorder from '@/components/ui/VoiceMessageRecorder'
import { LinkText } from '@/components/ui/LinkPreview'
import ImageViewer from '@/components/ui/ImageViewer'
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
  const [viewImage, setViewImage] = useState<string | null>(null)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; username: string } | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevLengthRef = useRef(0)
  const convId = activeConversation?.id ?? ''
  const other = activeConversation?.other_user

  useMessages(convId)
  const { callState, startCall, acceptCall, declineCall, leaveCall, endCall, rejoinCall } = useVoiceCall(other?.id ?? '')
  const { profile: myProfile } = useAuthStore()
  const { isOtherTyping, sendTyping, stopTyping } = useTyping(convId, other?.id ?? '')
  const { reactions, toggleReaction, fetchReactions } = useReactions(convId)
  const convMessages = messages[convId] ?? []

  useEffect(() => {
    if (convId) setTimeout(() => inputRef.current?.focus(), 100)
  }, [convId])

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
      .select()
      .then(({ error }: any) => { if (error) console.error('read_at error:', error) })
  }, [convId, convMessages.length])

  // Check if blocked
  useEffect(() => {
    if (!profile || !other) return
    Promise.all([
      supabase.from('blocks' as any).select('id').eq('blocker_id', profile.id).eq('blocked_id', other.id).maybeSingle(),
      supabase.from('blocks' as any).select('id').eq('blocker_id', other.id).eq('blocked_id', profile.id).maybeSingle()
    ]).then(([{ data: d1 }, { data: d2 }]) => setIsBlocked(!!d1 || !!d2))
  }, [profile?.id, other?.id])

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
    await (supabase.from('direct_messages') as any).insert({
      conversation_id: convId, sender_id: profile.id,
      content: content || null, image_url,
      reply_to_id: replyTo?.id ?? null,
      reply_preview: replyTo ? `@${replyTo.username}: ${replyTo.content?.slice(0, 80)}` : null
    })
    setReplyTo(null)
    setSending(false)
  }

  const sendVoiceMessage = async (blob: Blob, duration: number) => {
    if (!profile || !activeConversation) return
    setVoiceError('')
    try {
      const path = `voice/${profile.id}_${Date.now()}.webm`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('messages').upload(path, blob, { contentType: 'audio/webm', upsert: true })
      if (uploadError) { setVoiceError('Yükleme hatası: ' + uploadError.message); return }
      const { data: { publicUrl } } = supabase.storage.from('messages').getPublicUrl(path)
      const { error: insertError } = await (supabase.from('direct_messages') as any).insert({
        conversation_id: convId, sender_id: profile.id,
        content: null, image_url: publicUrl, voice_duration: duration
      })
      if (insertError) { setVoiceError('Gönderme hatası: ' + insertError.message); return }
      setShowVoiceRecorder(false)
    } catch (e: any) { setVoiceError('Hata: ' + e.message) }
  }

  const deleteMessage = async (msgId: string) => {
    await (supabase.from('direct_messages') as any).update({ deleted_at: new Date().toISOString() }).eq('id', msgId)
  }

  const editMessage = async (msgId: string, newContent: string) => {
    await (supabase.from('direct_messages') as any).update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', msgId)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    if (e.key === 'Escape' && replyTo) setReplyTo(null)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (e.target.value) sendTyping(); else stopTyping()
  }

  const loadMoreMessages = async () => {
    if (!convId || loadingMore || !hasMore) return
    setLoadingMore(true)
    const oldest = convMessages[0]
    if (!oldest) { setLoadingMore(false); return }
    const { data } = await supabase
      .from('direct_messages').select('*')
      .eq('conversation_id', convId).is('deleted_at', null)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false }).limit(50)
    if (data && data.length > 0) {
      useChatStore.setState(state => ({
        messages: { ...state.messages, [convId]: [...data.reverse(), ...(state.messages[convId] || [])] }
      }))
      if (data.length < 50) setHasMore(false)
    } else { setHasMore(false) }
    setLoadingMore(false)
  }

  const grouped = groupMessages(convMessages.filter(m => {
    if ((m as any).deleted_at) return false
    if (isBlocked && m.sender_id !== profile?.id) return false
    return true
  }))

  const lastSeen = other?.status !== 'online' && (other as any)?.updated_at
    ? formatDistanceToNow(new Date((other as any).updated_at), { addSuffix: true, locale: tr }) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: '#0d0d14' }}>

      {/* 1:1 Call overlay */}
      {callState.active && (
        <div className="absolute inset-x-0 top-0 z-50" style={{ height: '50%' }}>
          <VoiceCallOverlay
            status={callState.status}
            currentUser={myProfile}
            otherUser={other}
            isIncoming={callState.isIncoming}
            callerProfile={callState.callerProfile}
            onEnd={endCall}
            onLeave={leaveCall}
            onAccept={acceptCall}
            onDecline={declineCall}
            onRejoin={rejoinCall}
            globalMicMuted={globalMicMuted}
          />
        </div>
      )}

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
        <button onClick={() => startCall()}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{ background: callState.active ? 'rgba(61,255,154,0.15)' : 'rgba(255,255,255,0.05)', color: callState.active ? '#3dff9a' : 'rgba(255,255,255,0.4)', border: `1px solid ${callState.active ? 'rgba(61,255,154,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
          <Phone size={15} strokeWidth={1.75} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1 relative"
        onScroll={e => {
          const el = e.currentTarget
          setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
          if (el.scrollTop < 100) loadMoreMessages()
        }}>
        {hasMore && (
          <div className="flex justify-center py-2">
            <button onClick={loadMoreMessages} disabled={loadingMore}
              className="text-xs px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {loadingMore ? 'Yükleniyor...' : '↑ Daha eski mesajlar'}
            </button>
          </div>
        )}
        {grouped.map((group, gi) => (
          <MessageGroup
            key={group[0].id + gi}
            group={group}
            currentUserId={profile?.id ?? ''}
            reactions={reactions}
            onReact={toggleReaction}
            onDelete={deleteMessage}
            onEdit={editMessage}
            onReply={msg => setReplyTo({ id: msg.id, content: msg.content ?? '', username: other?.username ?? '' })}
            onViewImage={setViewImage}
            otherUser={other}
            currentUser={profile}
          />
        ))}
        {isOtherTyping && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: '#c044ff', animation: `pulse-dot ${0.6+i*0.15}s ease-in-out infinite alternate` }} />)}
            </div>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>yazıyor...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
          style={{ bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(192,68,255,0.9)', color: 'white', border: '1px solid rgba(192,68,255,0.5)', zIndex: 10 }}>
          <ChevronDown size={14} strokeWidth={2.5} /> Yeni mesajlar
        </button>
      )}

      {/* Reply bar */}
      {replyTo && <ReplyBar reply={replyTo} onCancel={() => setReplyTo(null)} />}

      {/* Voice recorder */}
      {showVoiceRecorder && (
        <div className="px-5 pb-3 flex-shrink-0">
          <VoiceMessageRecorder
            onSend={sendVoiceMessage}
            onCancel={() => { setShowVoiceRecorder(false); setVoiceError('') }} />
          {voiceError && <p className="text-xs mt-1" style={{ color: '#ff6b9d' }}>{voiceError}</p>}
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="px-5 pb-2 flex-shrink-0">
          <div className="relative inline-block">
            <img src={imagePreview} alt="" className="rounded-xl" style={{ maxHeight: 100, maxWidth: 180, objectFit: 'cover' }} />
            <button onClick={() => { setImageFile(null); setImagePreview('') }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#ff6b9d', border: '2px solid #0d0d14', color: 'white' }}>
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {isBlocked ? (
        <div className="px-5 pb-4 pt-2 flex-shrink-0">
          <div className="px-4 py-3 rounded-2xl text-sm text-center"
            style={{ background: 'rgba(255,107,157,0.08)', border: '1px solid rgba(255,107,157,0.15)', color: 'rgba(255,255,255,0.4)' }}>
            Bu kullanıcıyla mesajlaşamazsınız.
          </div>
        </div>
      ) : !showVoiceRecorder && (
        <div className="px-5 pb-4 pt-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => fileRef.current?.click()}
              className="flex-shrink-0 transition-all"
              style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Paperclip size={16} strokeWidth={1.75} />
            </button>
            <input ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKey}
              placeholder={`${other?.username} kişisine mesaj yaz...`}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#f0eeff', fontFamily: 'DM Sans, sans-serif' }} />
            <EmojiPickerBtn onEmoji={emoji => setInput(p => p + emoji)} />
            {!input.trim() && !imageFile && (
              <button onClick={() => { setShowVoiceRecorder(true); setVoiceError('') }}
                className="w-7 h-7 flex items-center justify-center"
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
          <input ref={fileRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleImageSelect} />
        </div>
      )}

      {viewImage && <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />}
    </div>
  )
}

function MessageGroup({ group, currentUserId, reactions, onReact, onDelete, onEdit, onReply, onViewImage, otherUser, currentUser }: {
  group: DirectMessage[]; currentUserId: string
  reactions: Record<string, any[]>; onReact: (id: string, emoji: string) => void
  onDelete: (id: string) => void; onEdit: (id: string, content: string) => void
  onReply: (msg: DirectMessage) => void; onViewImage: (url: string) => void
  otherUser?: any; currentUser?: any
}) {
  const isOwn = group[0].sender_id === currentUserId
  const lastMsg = group[group.length - 1]
  const isRead = lastMsg.read_at !== null
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number; content: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const startEdit = (msg: DirectMessage) => { setEditingId(msg.id); setEditText(msg.content ?? '') }
  const submitEdit = async (msgId: string) => {
    if (editText.trim()) await onEdit(msgId, editText.trim())
    setEditingId(null)
  }

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} gap-0.5 mb-2`}>
      <style>{`.msg-fade-out{animation:fadeOut 0.2s ease-out forwards}@keyframes fadeOut{to{opacity:0;transform:scale(0.95)}}`}</style>
      {group.map((msg, i) => {
        const msgReactions = reactions[msg.id] ?? []
        const isEditing = editingId === msg.id
        return (
          <div key={msg.id} className="relative w-full"
            onMouseEnter={() => setHoveredMsg(msg.id)}
            onMouseLeave={() => setHoveredMsg(null)}
            onContextMenu={e => { e.preventDefault(); if (msg.content) setContextMenu({ msgId: msg.id, x: e.clientX, y: e.clientY, content: msg.content }) }}>
            <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 h-7 flex-shrink-0">
                {!isOwn && i === group.length - 1 && (
                  <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
                    {otherUser?.avatar_url
                      ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (otherUser?.username ?? '').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ maxWidth: 380 }}>
                {(msg as any).reply_preview && (
                  <div className="px-3 py-1.5 mb-1 rounded-xl text-xs"
                    style={{ background: 'rgba(255,255,255,0.05)', borderLeft: '2px solid rgba(192,68,255,0.5)', color: 'rgba(255,255,255,0.45)' }}>
                    {(msg as any).reply_preview}
                  </div>
                )}
                {(msg as any).image_url && (
                  (msg as any).voice_duration ? (
                    <div className="mb-1">
                      <audio controls src={(msg as any).image_url}
                        style={{ height: 40, maxWidth: 260, borderRadius: 12 }} />
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        🎤 {Math.floor((msg as any).voice_duration / 60)}:{((msg as any).voice_duration % 60).toString().padStart(2,'0')}
                      </p>
                    </div>
                  ) : (
                    <img src={(msg as any).image_url} alt=""
                      className="rounded-xl mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ maxWidth: 280, maxHeight: 280, objectFit: 'cover', display: 'block' }}
                      onClick={() => onViewImage((msg as any).image_url)} />
                  )
                )}
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input value={editText} onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitEdit(msg.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(192,68,255,0.4)', color: '#e8e6f0', minWidth: 200 }}
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
                    <LinkText content={msg.content} />
                    {(msg as any).edited_at && <span className="ml-1 text-xs opacity-50">(düzenlendi)</span>}
                  </div>
                ) : null}
                {msgReactions.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {msgReactions.map(r => (
                      <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs"
                        style={{ background: r.userReacted ? 'rgba(192,68,255,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${r.userReacted ? 'rgba(192,68,255,0.35)' : 'rgba(255,255,255,0.1)'}` }}>
                        <span>{r.emoji}</span>
                        <span style={{ color: r.userReacted ? '#c044ff' : 'rgba(255,255,255,0.5)' }}>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {hoveredMsg === msg.id && !isEditing && (
                <div className={`absolute ${isOwn ? 'right-10' : 'left-10'} -top-8 flex items-center gap-1 px-2 py-1 rounded-xl z-10`}
                  style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {QUICK_REACTIONS.map(emoji => (
                    <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                      className="text-base hover:scale-125 transition-transform w-6 h-6 flex items-center justify-center">
                      {emoji}
                    </button>
                  ))}
                  <button onClick={() => onReply(msg)} className="w-6 h-6 flex items-center justify-center rounded ml-1" style={{ color: 'rgba(255,255,255,0.5)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c044ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'}>
                    <Reply size={12} strokeWidth={2} />
                  </button>
                  {msg.content && (
                    <button onClick={() => navigator.clipboard.writeText(msg.content ?? '')} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'rgba(255,255,255,0.5)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#3dff9a'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'}>
                      <Copy size={12} strokeWidth={2} />
                    </button>
                  )}
                  {isOwn && msg.content && (
                    <button onClick={() => startEdit(msg)} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'rgba(255,255,255,0.5)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c044ff'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'}>
                      <Pencil size={12} strokeWidth={2} />
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => onDelete(msg.id)} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'rgba(255,255,255,0.5)' }}
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
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[400]" onClick={() => setContextMenu(null)} />
          <div className="fixed z-[401] rounded-xl overflow-hidden py-1"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 180), background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 168 }}>
            <button onClick={() => { navigator.clipboard.writeText(contextMenu.content); setContextMenu(null) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <Copy size={13} strokeWidth={2} /> Kopyala
            </button>
            <button onClick={() => { onReply(group.find(m => m.id === contextMenu.msgId)!); setContextMenu(null) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <Reply size={13} strokeWidth={2} /> Yanıtla
            </button>
            {isOwn && (
              <button onClick={() => { const m = group.find(g => g.id === contextMenu.msgId); if(m) startEdit(m); setContextMenu(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <Pencil size={13} strokeWidth={2} /> Düzenle
              </button>
            )}
            {isOwn && (
              <button onClick={() => { onDelete(contextMenu.msgId); setContextMenu(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                style={{ color: '#ff6b9d' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,157,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <Trash2 size={13} strokeWidth={2} /> Sil
              </button>
            )}
          </div>
        </>
      )}
      <div className="flex items-center gap-1 mt-0.5 px-9 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        <span>{format(new Date(lastMsg.created_at), 'HH:mm')}</span>
        {isOwn && <span style={{ color: isRead ? '#c044ff' : 'rgba(255,255,255,0.2)' }}>{isRead ? ' ✓✓' : ' ✓'}</span>}
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
