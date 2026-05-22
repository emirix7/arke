export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          status: 'online' | 'idle' | 'dnd' | 'offline'
          custom_status: string | null
          allow_messages_from: 'everyone' | 'friends'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      friendships: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['friendships']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['friendships']['Insert']>
      }
      direct_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          read_at: string | null
          created_at: string
          edited_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['direct_messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['direct_messages']['Insert']>
      }
      conversations: {
        Row: {
          id: string
          participant_1: string
          participant_2: string
          created_at: string
          last_message_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Friendship = Database['public']['Tables']['friendships']['Row']
export type DirectMessage = Database['public']['Tables']['direct_messages']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']

export type FriendWithProfile = Friendship & {
  profile: Profile
}

export type ConversationWithProfile = Conversation & {
  other_user: Profile
  last_message?: DirectMessage
  unread_count?: number
}
