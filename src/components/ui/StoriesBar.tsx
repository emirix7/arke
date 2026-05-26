'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Plus, X, ChevronLeft, ChevronRight, Settings, Globe, Users } from 'lucide-react'

interface Story {
  id: string; user_id: string; media_url: string
  media_type: string; caption?: string; expires_at: string
  profile?: { username: string; avatar_url?: string }
}

interface StoryGroup {
  userId: string; username: string; avatar?: string; stories: Story[]; hasNew: boolean
}

export default function StoriesBar() {
  const { profile } = useAuthStore()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [viewing, setViewing] = useState<{ group: StoryGroup; storyIndex: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [storyPrivacy, setStoryPrivacy] = useState<'everyone' | 'friends'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('arke_story_privacy') as any) || 'everyone'
    return 'everyone'
  })
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchStories()
    const interval = setInterval(fetchStories, 30000)
    return () => clearInterval(interval)
  }, [profile?.id])

  const fetchStories = async () => {
    if (!profile) return
    // Get friend IDs for privacy filter
    const { data: friendships } = await supabase.from('friendships')
      .select('sender_id, receiver_id').eq('status', 'accepted')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
    const friendIds = new Set<string>([profile.id])
    if (friendships) friendships.forEach((f: any) => {
      if (f.sender_id === profile.id) friendIds.add(f.receiver_id)
      else friendIds.add(f.sender_id)
    })

    const { data } = await supabase.from('stories')
      .select('*, profile:profiles(username, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (!data) return

    const map = new Map<string, StoryGroup>()
    data.filter((s: any) => {
      // Always show own stories
      if (s.user_id === profile.id) return true
      // Check story privacy - if story owner only shares with friends, check if we're friends
      return friendIds.has(s.user_id)
    }).forEach((s: any) => {
      if (!map.has(s.user_id)) {
        map.set(s.user_id, { userId: s.user_id, username: s.profile?.username ?? '?', avatar: s.profile?.avatar_url, stories: [], hasNew: true })
      }
      map.get(s.user_id)!.stories.push(s)
    })

    const own = map.get(profile.id)
    const others = [...map.values()].filter(g => g.userId !== profile.id)
    const ownPlaceholder: StoryGroup = { userId: profile.id, username: profile.username, avatar: profile.avatar_url ?? undefined, stories: [], hasNew: false }
    setGroups(own ? [own, ...others] : [ownPlaceholder, ...others])
  }

  const uploadStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !profile) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const { data } = await supabase.storage.from('messages').upload(`stories/${profile.id}/${Date.now()}.${ext}`, file, { upsert: true })
    if (data) {
      const url = supabase.storage.from('messages').getPublicUrl(data.path).data.publicUrl
      await supabase.from('stories').insert({ user_id: profile.id, media_url: url, media_type: file.type.startsWith('video') ? 'video' : 'image' })
      fetchStories()
    }
    setUploading(false)
    e.target.value = ''
  }

  const grads = ['linear-gradient(135deg,#ff6b9d,#c044ff)', 'linear-gradient(135deg,#00d4ff,#0080ff)', 'linear-gradient(135deg,#ffb347,#ff6b9d)', 'linear-gradient(135deg,#3dff9a,#00d4ff)']

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 relative"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3 flex-1 overflow-x-auto">
        {groups.map(group => {
          const hasStory = group.stories.length > 0
          const isOwn = group.userId === profile?.id
          const grad = grads[group.username.charCodeAt(0) % grads.length]
          return (
            <div key={group.userId} className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
              onClick={() => hasStory ? setViewing({ group, storyIndex: 0 }) : isOwn ? fileRef.current?.click() : null}>
              <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: hasStory ? 'linear-gradient(135deg,#c044ff,#00d4ff,#ff6b9d)' : grad, padding: hasStory ? 2 : 0 }}>
                  <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                    style={{ background: grad, border: hasStory ? '2px solid #0d0d14' : 'none' }}>
                    {group.avatar ? <img src={group.avatar} alt="" className="w-full h-full object-cover" /> : group.username.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                {isOwn && (
                  <button onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: '#c044ff', border: '2px solid #0d0d14' }}>
                    {uploading ? <span className="w-2 h-2 rounded-full border border-white border-t-transparent animate-spin" /> : <Plus size={10} strokeWidth={3} style={{ color: 'white' }} />}
                  </button>
                )}
              </div>
              <span className="truncate" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, maxWidth: 48 }}>
                {isOwn ? 'Hikayem' : group.username}
              </span>
            </div>
          )
        })}
        </div>
        <button onClick={() => setShowPrivacyMenu(true)} title="Hikaye Ayarları"
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,68,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#c044ff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(192,68,255,0.25)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}>
          <Settings size={14} strokeWidth={1.75} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*,.gif" className="hidden" onChange={uploadStory} />


      </div>

      {showPrivacyMenu && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowPrivacyMenu(false)}>
          <div className="w-80 rounded-2xl overflow-hidden"
            style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-syne font-bold text-sm" style={{ color: '#f0eeff' }}>Hikaye Gizlilik Ayarı</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Hikayelerini kimler görebilir?</p>
            </div>
            <div className="p-3 flex flex-col gap-2">
              <button onClick={() => { setStoryPrivacy('everyone'); localStorage.setItem('arke_story_privacy', 'everyone'); setShowPrivacyMenu(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                style={{ background: storyPrivacy === 'everyone' ? 'rgba(192,68,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${storyPrivacy === 'everyone' ? 'rgba(192,68,255,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: storyPrivacy === 'everyone' ? 'rgba(192,68,255,0.2)' : 'rgba(255,255,255,0.06)' }}>
                  <Globe size={16} strokeWidth={1.75} style={{ color: storyPrivacy === 'everyone' ? '#c044ff' : 'rgba(255,255,255,0.5)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: storyPrivacy === 'everyone' ? '#c044ff' : '#e8e6f0' }}>Herkes</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Tüm Arke kullanıcıları görebilir</p>
                </div>
                {storyPrivacy === 'everyone' && <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#c044ff' }}><span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span></div>}
              </button>
              <button onClick={() => { setStoryPrivacy('friends'); localStorage.setItem('arke_story_privacy', 'friends'); setShowPrivacyMenu(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                style={{ background: storyPrivacy === 'friends' ? 'rgba(192,68,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${storyPrivacy === 'friends' ? 'rgba(192,68,255,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: storyPrivacy === 'friends' ? 'rgba(192,68,255,0.2)' : 'rgba(255,255,255,0.06)' }}>
                  <Users size={16} strokeWidth={1.75} style={{ color: storyPrivacy === 'friends' ? '#c044ff' : 'rgba(255,255,255,0.5)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: storyPrivacy === 'friends' ? '#c044ff' : '#e8e6f0' }}>Sadece Arkadaşlar</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Yalnızca arkadaş listendekiler</p>
                </div>
                {storyPrivacy === 'friends' && <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#c044ff' }}><span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span></div>}
              </button>
            </div>
            <div className="px-3 pb-3">
              <button onClick={() => setShowPrivacyMenu(false)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <StoryViewer
          group={viewing.group}
          storyIndex={viewing.storyIndex}
          onNext={() => {
            if (viewing.storyIndex < viewing.group.stories.length - 1) {
              setViewing({ ...viewing, storyIndex: viewing.storyIndex + 1 })
            } else {
              setViewing(null)
            }
          }}
          onPrev={() => {
            if (viewing.storyIndex > 0) setViewing({ ...viewing, storyIndex: viewing.storyIndex - 1 })
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  )
}

function StoryViewer({ group, storyIndex, onNext, onPrev, onClose }: {
  group: StoryGroup; storyIndex: number
  onNext: () => void; onPrev: () => void; onClose: () => void
}) {
  const story = group.stories[storyIndex]
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    setProgress(0)
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { onNext(); return 0 }
        return p + 2
      })
    }, 100)
    return () => clearInterval(timerRef.current)
  }, [storyIndex])

  if (!story) return null

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.95)' }} onClick={onClose}>
      <div className="relative rounded-2xl overflow-hidden" style={{ width: 320, aspectRatio: '9/16', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}>
        {/* Progress */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.3)' }}>
              <div className="h-full rounded-full" style={{ width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%', background: 'white', transition: 'none' }} />
            </div>
          ))}
        </div>
        {/* Header */}
        <div className="absolute top-6 left-3 right-3 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#c044ff,#00d4ff)' }}>
            {group.avatar ? <img src={group.avatar} alt="" className="w-full h-full object-cover" /> : group.username.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-white flex-1">{group.username}</span>
          <button onClick={onClose} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {/* Media */}
        {story.media_type === 'video'
          ? <video src={story.media_url} autoPlay loop muted className="w-full h-full object-cover" />
          : <img src={story.media_url} alt="" className="w-full h-full object-cover" />}
        {/* Nav zones */}
        <div className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer" onClick={e => { e.stopPropagation(); onPrev() }} />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer" onClick={e => { e.stopPropagation(); onNext() }} />
        {/* Arrows */}
        {storyIndex > 0 && (
          <button onClick={e => { e.stopPropagation(); onPrev() }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', cursor: 'pointer' }}>
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onNext() }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', cursor: 'pointer' }}>
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
