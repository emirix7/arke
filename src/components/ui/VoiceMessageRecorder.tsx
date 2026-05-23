'use client'
import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Send, X } from 'lucide-react'

interface VoiceMessageRecorderProps {
  onSend: (blob: Blob, duration: number) => void
  onCancel: () => void
}

export default function VoiceMessageRecorder({ onSend, onCancel }: VoiceMessageRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    startRecording()
    return () => { stopRecording(); clearInterval(intervalRef.current) }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      setRecording(true)
      intervalRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (e) { onCancel() }
  }

  const stopRecording = () => {
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop()
      setRecording(false)
      clearInterval(intervalRef.current)
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
      style={{ background: 'rgba(192,68,255,0.08)', border: '1px solid rgba(192,68,255,0.2)' }}>
      {recording ? (
        <>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ff6b9d', animation: 'pulse-dot 1s infinite' }} />
          <span className="text-sm font-mono flex-1" style={{ color: '#e8e6f0' }}>{fmt(duration)}</span>
          <button onClick={stopRecording} title="Durdur"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,107,157,0.15)', border: '1px solid rgba(255,107,157,0.3)', color: '#ff6b9d' }}>
            <Square size={14} strokeWidth={2} fill="currentColor" />
          </button>
        </>
      ) : audioBlob ? (
        <>
          <audio src={audioUrl} controls className="flex-1" style={{ height: 32, minWidth: 0 }} />
          <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{fmt(duration)}</span>
          <button onClick={() => onSend(audioBlob, duration)} title="Gönder"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)', color: 'white', border: 'none' }}>
            <Send size={14} strokeWidth={2} />
          </button>
        </>
      ) : null}
      <button onClick={onCancel} title="İptal"
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer' }}>
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}
