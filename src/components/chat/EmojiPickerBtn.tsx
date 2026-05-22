'use client'
import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

const Picker = dynamic(() => import('@emoji-mart/react'), { ssr: false })

interface EmojiPickerBtnProps {
  onEmoji: (emoji: string) => void
}

export default function EmojiPickerBtn({ onEmoji }: EmojiPickerBtnProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}
      >
        😊
      </button>
      {open && (
        <div className="absolute bottom-10 right-0 z-50">
          <Picker
            data={async () => {
              const r = await import('@emoji-mart/data')
              return r.default
            }}
            onEmojiSelect={(e: { native: string }) => {
              onEmoji(e.native)
              setOpen(false)
            }}
            theme="dark"
            locale="tr"
            previewPosition="none"
          />
        </div>
      )}
    </div>
  )
}
