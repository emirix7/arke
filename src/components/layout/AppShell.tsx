'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'
import ServerSidebar from '@/components/servers/ServerSidebar'
import ChannelSidebar from '@/components/servers/ChannelSidebar'
import ChannelChat from '@/components/servers/ChannelChat'
import VoiceChannel from '@/components/servers/VoiceChannel'
import FriendsPanel from '@/components/friends/FriendsPanel'
import ChatArea from '@/components/chat/ChatArea'
import ProfilePanel from '@/components/profile/ProfilePanel'
import FriendRequests from '@/components/friends/FriendRequests'
import SettingsPage from '@/components/profile/SettingsPage'
import IncomingCallBanner from '@/components/chat/IncomingCallBanner'
import { useChatStore } from '@/store/chat'
import { useServerStore } from '@/store/server'
import { useGlobalCall } from '@/hooks/useGlobalCall'
import { useReconnect } from '@/hooks/useReconnect'
import type { Server } from '@/types/server'

export type AppView = 'messages' | 'friends' | 'calls' | 'settings' | 'server'

export default function AppShell() {
  const [view, setView] = useState<AppView>('messages')
  const [dnd, setDnd] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const { activeConversation } = useChatStore()
  const { activeServer, setActiveServer, activeChannel, setActiveChannel } = useServerStore()
  const { incomingCall, acceptCall, declineCall } = useGlobalCall()
  useReconnect()

  const handleServerSelect = (server: Server) => {
    setActiveServer(server)
    setActiveChannel(null)
    setView('server')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0d0d14' }}>
      <div className="titlebar absolute top-0 left-0 right-0 z-50" />

      {/* Server sidebar — always visible */}
      <ServerSidebar onSelect={handleServerSelect} activeServerId={view === 'server' ? activeServer?.id : undefined} />

      <Sidebar
        activeView={view}
        onViewChange={(v) => { setView(v); if (v !== 'server') setActiveServer(null) }}
        dnd={dnd}
        micMuted={micMuted}
        onToggleDnd={() => setDnd(p => !p)}
        onToggleMic={() => setMicMuted(p => !p)}
      />

      {view === 'messages' && (
        <>
          <FriendsPanel />
          {activeConversation ? (
            <>
              <ChatArea globalMicMuted={micMuted} />
              <ProfilePanel />
            </>
          ) : <EmptyState />}
        </>
      )}

      {view === 'friends' && <div className="flex-1 overflow-hidden"><FriendRequests /></div>}
      {view === 'settings' && <div className="flex-1 overflow-hidden"><SettingsPage /></div>}

      {view === 'server' && activeServer && (
        <>
          <ChannelSidebar />
          {activeChannel?.type === 'voice' ? (
            <VoiceChannel channel={activeChannel} onLeave={() => setActiveChannel(null)} />
          ) : activeChannel?.type === 'text' ? (
            <ChannelChat />
          ) : <EmptyState text="Bir kanal seç" />}
        </>
      )}

      {incomingCall && !dnd && (
        <IncomingCallBanner
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          onAccept={() => { acceptCall(); setView('messages') }}
          onDecline={declineCall}
        />
      )}
    </div>
  )
}

function EmptyState({ text = 'Bir sohbet seç' }: { text?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: '#0d0d14' }}>
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(192,68,255,0.1)', border: '1px solid rgba(192,68,255,0.15)' }}>
        <span className="text-3xl">💬</span>
      </div>
      <p className="font-syne font-semibold text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>{text}</p>
    </div>
  )
}
