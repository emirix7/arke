'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface GifPickerProps {
  onSelect: (url: string) => void
  onClose: () => void
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Use Tenor API (free, no key needed for basic use)
  const TENOR_KEY = 'AIzaSyAyimkuYQYF_FXVALexPzkcsvZnUpdated' // public demo key
  
  useEffect(() => {
    fetchGifs('trending')
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchGifs = async (searchQuery: string) => {
    setLoading(true)
    try {
      const endpoint = searchQuery === 'trending'
        ? `https://tenor.googleapis.com/v2/featured?key=AIzaSyBFMAFGUFzS8gZHrqpzAEklxfkXXkpRDm4&limit=20&media_filter=gif`
        : `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchQuery)}&key=AIzaSyBFMAFGUFzS8gZHrqpzAEklxfkXXkpRDm4&limit=20&media_filter=gif`
      const res = await fetch(endpoint)
      const data = await res.json()
      const urls = (data.results || []).map((r: any) => r.media_formats?.gif?.url || r.media_formats?.tinygif?.url).filter(Boolean)
      setGifs(urls)
    } catch {
      setGifs([])
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => { if (query) fetchGifs(query); else fetchGifs('trending') }, 500)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div ref={ref} className="absolute bottom-14 right-0 rounded-2xl overflow-hidden z-50"
      style={{ width: 340, height: 380, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {/* Search */}
      <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search size={13} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="GIF ara..." autoFocus
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }} />
        </div>
      </div>

      {/* GIF Grid */}
      <div className="overflow-y-auto p-2" style={{ height: 'calc(100% - 58px)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(192,68,255,0.3)', borderTopColor: '#c044ff' }} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((url, i) => (
              <button key={i} onClick={() => { onSelect(url); onClose() }}
                className="rounded-xl overflow-hidden transition-transform hover:scale-105"
                style={{ aspectRatio: '16/9', background: 'rgba(255,255,255,0.05)' }}>
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
            {gifs.length === 0 && !loading && (
              <div className="col-span-2 flex items-center justify-center h-24 text-sm"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {query ? 'Sonuç bulunamadı' : 'Trend GIFler yükleniyor...'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
