import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function POST(req: Request) {
  const { roomName, identity } = await req.json()

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
  }

  const token = new AccessToken(apiKey, apiSecret, { identity })
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  })

  return NextResponse.json({ token: await token.toJwt() })
}
