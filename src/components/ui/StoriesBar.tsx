'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [viewing, setViewing] = useState<{ group: StoryGroup; index: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchStories()
    const interval = setInterval(fetchStories, 30000)
    return () => clearInterval(interval)
  }, [profile?.id])

  const fetchStories = async () => {
    if (!profile) return
    const { data } = await supabase.from('stories')
      .select('*, profile:profiles(username, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (!data) return

    // Group by user
    const map = new Map<string, StoryGroup>()
    data.forEach((s: any) => {
      if (!map.has(s.user_id)) {
        map.set(s.user_id, { userId: s.user_id, username: s.profile?.username ?? '?', avatar: s.profile?.avatar_url, stories: [], hasNew: true })
      }
      map.get(s.user_id)!.stories.push(s)
    })

    // Own story first
    const own = map.get(profile.id)
    const others = [...map.values()].filter(g => g.userId !== profile.id)
    setGroups(own ? [own, ...others] : [{ userId: profile.id, username: profile.username, avatar: profile.avatar_url ?? undefined, stories: [], hasNew: false }, ...others])
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
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {groups.map(group => (
          <StoryAvatar key={group.userId} group={group} isOwn={group.userId === profile?.id}
            onAdd={() => fileRef.current?.click()}
            onClick={() => group.stories.length > 0 && setViewing({ group, index: 0 })}
            uploading={uploading && group.userId === profile?.id} />
        ))}
        <input ref={fileRef} type="file" accept="image/*,video/*,.gif" className="hidden" onChange={uploadStory} />
      </div>

      {viewing && (
        <StoryViewer group={viewing.group} index={viewing.index}
          onIndexChange={i => setViewing({ ...viewing, index: i })}
          onClose={() => setViewing(null)} />
      )}
    </>
  )
}

function StoryAvatar({ group, isOwn, onAdd, onClick, uploading }: {
  group: StoryGroup; isOwn: boolean; onAdd: () => void; onClick: () => void; uploading: boolean
}) {
  const grads = ['linear-gradient(135deg,#ff6b9d,#c044ff)', 'linear-gradient(135deg,#00d4ff,#0080ff)', 'linear-gradient(135deg,#ffb347,#ff6b9d)', 'linear-gradient(135deg,#3dff9a,#00d4ff)']
  const hasStory = group.stories.length > 0

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={onClick}>
      <div className="relative">
        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold text-white"
          style={{
            background: group.avatar ? 'transparent' : grads[group.username.charCodeAt(0) % grads.length],
            padding: hasStory ? 2 : 0,
            background: hasStory ? 'linear-gradient(135deg, #c044ff, #00d4ff, #ff6b9d)' : grads[group.username.charCodeAt(0) % grads.length],
          }}>
          <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: grads[group.username.charCodeAt(0) % grads.length], border: hasStory ? '2px solid #0d0d14' : 'none' }}>
            {group.avatar ? <img src={group.avatar} alt="" className="w-full h-full object-cover" /> : group.username.slice(0, 2).toUpperCase()}
          </div>
        </div>
        {isOwn && (
          <button onClick={e => { e.stopPropagation(); onAdd() }}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: '#c044ff', border: '2px solid #0d0d14' }}>
            {uploading ? <span className="w-2 h-2 rounded-full border border-white border-t-transparent animate-spin" /> : <Plus size={10} strokeWidth={3} style={{ color: 'white' }} />}
          </button>
        )}
      </div>
      <span className="text-xs truncate max-w-12" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
        {isOwn ? 'Hikayem' : group.username}
      </span>
    </div>
  )
}

function StoryViewer({ group, index, onIndexChange, onClose }: {
  group: StoryGroup; index: number; onIndexChange: (i: number) => void; onClose: () => void
}) {
  const story = group.stories[index]
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (index < group.stories.length - 1) onIndexChange(index + 1)
          else onClose()
          return 0
        }
        return p + 2
      })
    }, 100) // 5 seconds per story
    return () => clearInterval(interval)
  }, [index])

  if (!story) return null

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.95)' }} onClick={onClose}>
      <div className="relative w-80 rounded-2xl overflow-hidden" style={{ maxHeight: '80vh', aspectRatio: '9/16' }}
        onClick={e => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.3)' }}>
              <div className="h-full rounded-full transition-none" style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%', background: 'white' }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-3 right-3 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
            {group.avatar ? <img src={group.avatar} alt="" className="w-full h-full object-cover" /> : group.username.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-white">{group.username}</span>
          <button onClick={onClose} className="ml-auto" style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Media */}
        {story.media_type === 'video'
          ? <video src={story.media_url} autoPlay loop muted className="w-full h-full object-cover" />
          : <img src={story.media_url} alt="" className="w-full h-full object-cover" />}

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-6 left-3 right-3 px-3 py-2 rounded-xl text-sm text-white"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            {story.caption}
          </div>
        )}

        {/* Nav */}
        {index > 0 && (
          <button onClick={() => onIndexChange(index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', cursor: 'pointer' }}>
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        )}
        {index < group.stories.length - 1 && (
          <button onClick={() => onIndexChange(index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', cursor: 'pointer' }}>
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  )
}
