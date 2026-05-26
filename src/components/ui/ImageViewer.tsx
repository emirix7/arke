'use client'
import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface ImageViewerProps {
  src: string
  onClose: () => void
}

export default function ImageViewer({ src, onClose }: ImageViewerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
        style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
        <X size={18} strokeWidth={2} />
      </button>
      <a href={src} download target="_blank" rel="noopener noreferrer"
        className="absolute top-4 right-16 w-10 h-10 rounded-full flex items-center justify-center z-10"
        style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <Download size={16} strokeWidth={2} />
      </a>
      <img src={src} alt="" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }} />
    </div>
  )
}
