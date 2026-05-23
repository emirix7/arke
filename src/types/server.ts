export interface Server {
  id: string
  name: string
  description?: string
  icon_url?: string
  banner_url?: string
  owner_id: string
  invite_code: string
  created_at: string
}

export interface ServerMember {
  id: string
  server_id: string
  user_id: string
  joined_at: string
  profile?: {
    id: string
    username: string
    avatar_url?: string
    status: string
  }
}

export interface Channel {
  id: string
  server_id: string
  name: string
  type: 'text' | 'voice'
  position: number
  created_at: string
}

export interface ChannelMessage {
  id: string
  channel_id: string
  sender_id: string
  content?: string
  image_url?: string
  deleted_at?: string
  created_at: string
  profile?: {
    username: string
    avatar_url?: string
  }
}
