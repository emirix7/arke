'use client'
import { Component, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d14' }}>
          <div className="flex flex-col items-center gap-4 max-w-sm text-center p-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,107,157,0.1)', border: '1px solid rgba(255,107,157,0.2)' }}>
              <AlertCircle size={28} strokeWidth={1.5} style={{ color: '#ff6b9d' }} />
            </div>
            <h2 className="font-syne font-bold text-lg" style={{ color: '#f0eeff' }}>Bir şeyler ters gitti</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Beklenmedik bir hata oluştu. Sayfayı yenileyerek tekrar deneyin.
            </p>
            <button onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
              <RefreshCw size={14} strokeWidth={2} /> Yenile
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
