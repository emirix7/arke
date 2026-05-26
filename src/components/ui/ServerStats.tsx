'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart2, Users, MessageSquare, Zap } from 'lucide-react'

interface ServerStatsProps {
  serverId: string
}

export default function ServerStats({ serverId }: ServerStatsProps) {
  const [stats, setStats] = useState<any>(null)
  const [topMembers, setTopMembers] = useState<any[]>([])

  useEffect(() => {
    fetchStats()
  }, [serverId])

  const fetchStats = async () => {
    // Basic stats
    const { data: members } = await supabase.from('server_members').select('user_id', { count: 'exact' }).eq('server_id', serverId)
    const { data: channels } = await supabase.from('channels').select('id').eq('server_id', serverId)
    const channelIds = channels?.map(c => c.id) ?? []

    let msgCount = 0
    if (channelIds.length > 0) {
      const { count } = await supabase.from('channel_messages').select('id', { count: 'exact', head: true }).in('channel_id', channelIds)
      msgCount = count ?? 0
    }

    setStats({ members: members?.length ?? 0, channels: channels?.length ?? 0, messages: msgCount })

    // Top members by message count
    if (channelIds.length > 0) {
      const { data: msgs } = await supabase.from('channel_messages')
        .select('sender_id, profile:profiles(username, avatar_url)')
        .in('channel_id', channelIds)
        .limit(500)

      if (msgs) {
        const counts: Record<string, { count: number; username: string; avatar?: string }> = {}
        msgs.forEach((m: any) => {
          if (!counts[m.sender_id]) counts[m.sender_id] = { count: 0, username: m.profile?.username ?? '?', avatar: m.profile?.avatar_url }
          counts[m.sender_id].count++
        })
        const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
        setTopMembers(sorted.map(([id, data]) => ({ id, ...data })))
      }
    }
  }

  if (!stats) return null

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl"
      style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="font-syne font-semibold text-sm flex items-center gap-2" style={{ color: '#f0eeff' }}>
        <BarChart2 size={15} strokeWidth={2} style={{ color: '#c044ff' }} /> Sunucu İstatistikleri
      </p>

      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<Users size={14} strokeWidth={2} />} label="Üye" value={stats.members} color="#00d4ff" />
        <StatCard icon={<MessageSquare size={14} strokeWidth={2} />} label="Mesaj" value={stats.messages} color="#c044ff" />
        <StatCard icon={<Zap size={14} strokeWidth={2} />} label="Kanal" value={stats.channels} color="#3dff9a" />
      </div>

      {topMembers.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>En Aktif Üyeler</p>
          {topMembers.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 py-1.5">
              <span className="text-xs font-bold w-4" style={{ color: i === 0 ? '#ffb347' : 'rgba(255,255,255,0.3)' }}>#{i + 1}</span>
              <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : m.username.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs flex-1 truncate" style={{ color: '#e8e6f0' }}>{m.username}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.count} mesaj</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
      style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <span style={{ color }}>{icon}</span>
      <span className="font-syne font-bold text-lg" style={{ color: '#f0eeff' }}>{value.toLocaleString()}</span>
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    </div>
  )
}
