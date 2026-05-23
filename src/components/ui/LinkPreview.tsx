'use client'
import { useState, useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'

const WARNED_KEY = 'arke_link_warned'

interface LinkPreviewProps {
  url: string
}

export function LinkText({ content }: { content: string }) {
  const [warnUrl, setWarnUrl] = useState<string | null>(null)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = content.split(urlRegex)

  const handleLinkClick = (url: string) => {
    const warned = localStorage.getItem(WARNED_KEY)
    if (warned) { window.open(url, '_blank', 'noopener noreferrer'); return }
    setWarnUrl(url)
  }

  const confirmOpen = () => {
    if (dontShowAgain) localStorage.setItem(WARNED_KEY, '1')
    window.open(warnUrl!, '_blank', 'noopener noreferrer')
    setWarnUrl(null)
  }

  return (
    <>
      <span>
        {parts.map((part, i) =>
          urlRegex.test(part) ? (
            <span key={i}>
              <button onClick={() => handleLinkClick(part)}
                className="inline-flex items-center gap-0.5 transition-all"
                style={{ color: '#00d4ff', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>
                {part.length > 50 ? part.slice(0, 50) + '...' : part}
                <ExternalLink size={11} strokeWidth={2} style={{ display: 'inline', marginLeft: 2 }} />
              </button>
            </span>
          ) : part
        )}
      </span>

      {warnUrl && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-80 rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center justify-between">
              <p className="font-syne font-bold text-sm" style={{ color: '#f0eeff' }}>Dış bağlantı</p>
              <button onClick={() => setWarnUrl(null)} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Bu bağlantı sizi Arke dışına çıkaracak:
            </p>
            <div className="px-3 py-2 rounded-xl text-xs font-mono break-all"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}>
              {warnUrl}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setDontShowAgain(p => !p)}
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                style={{ background: dontShowAgain ? '#c044ff' : 'rgba(255,255,255,0.08)', border: `1px solid ${dontShowAgain ? '#c044ff' : 'rgba(255,255,255,0.15)'}` }}>
                {dontShowAgain && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Bir daha gösterme</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setWarnUrl(null)}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                İptal
              </button>
              <button onClick={confirmOpen}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                Git
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
