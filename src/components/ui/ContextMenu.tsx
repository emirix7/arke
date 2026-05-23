'use client'
import { useEffect, useRef } from 'react'

interface MenuItem {
  label: string
  icon: string
  onClick: () => void
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler) }
  }, [])

  // Adjust position to stay in viewport
  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - items.length * 40 - 16)

  return (
    <div ref={ref}
      className="fixed z-[500] py-1.5 rounded-xl overflow-hidden"
      style={{
        left: adjustedX, top: adjustedY,
        background: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 160,
      }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.onClick(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-100"
          style={{ color: item.danger ? '#ff6b9d' : 'rgba(255,255,255,0.7)' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = item.danger ? 'rgba(255,107,157,0.1)' : 'rgba(255,255,255,0.06)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
          <span style={{ fontSize: 14 }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
