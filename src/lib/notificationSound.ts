'use client'
let audioCtx: AudioContext | null = null

function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioCtx
}

// DM / channel message sound - soft ping
export function playMessageSound() {
  if (typeof window !== 'undefined' && localStorage.getItem('arke_sound') === 'off') return
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(); osc.stop(ctx.currentTime + 0.25)
  } catch {}
}

// Incoming call sound - phone ringing pattern
let callRingInterval: any = null
export function startCallRinging() {
  stopCallRinging()
  const ring = () => {
    if (typeof window !== 'undefined' && localStorage.getItem('arke_sound') === 'off') return
    try {
      const ctx = getCtx()
      ;[0, 200].forEach(delay => {
        setTimeout(() => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(520, ctx.currentTime)
          gain.gain.setValueAtTime(0.22, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
          osc.start(); osc.stop(ctx.currentTime + 0.18)
        }, delay)
      })
    } catch {}
  }
  ring()
  callRingInterval = setInterval(ring, 3500)
}

export function stopCallRinging() {
  if (callRingInterval) { clearInterval(callRingInterval); callRingInterval = null }
}

// Outgoing call dialing sound
let dialInterval: any = null
export function startDialing() {
  stopDialing()
  const dial = () => {
    try {
      const ctx = getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 440
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(); osc.stop(ctx.currentTime + 0.4)
    } catch {}
  }
  dial()
  dialInterval = setInterval(dial, 2000)
}

export function stopDialing() {
  if (dialInterval) { clearInterval(dialInterval); dialInterval = null }
}

// Call connected sound
export function playCallConnected() {
  try {
    const ctx = getCtx()
    ;[0, 150].forEach((delay, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = i === 0 ? 880 : 1100
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
        osc.start(); osc.stop(ctx.currentTime + 0.2)
      }, delay)
    })
  } catch {}
}

// Mention notification - distinct sound
export function playMentionSound() {
  try {
    const ctx = getCtx()
    ;[0, 100, 200].forEach((delay, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = [660, 880, 1100][i]
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start(); osc.stop(ctx.currentTime + 0.15)
      }, delay)
    })
  } catch {}
}
