'use client'

// Thin alias kept so the scoreboard's import path is stable. The live-refresh
// logic now lives in the shared LiveStamp / useLiveRefresh so every leadership
// page can reuse it.
import LiveStamp from './LiveStamp'

export default function ScoreboardLive(props) {
  return <LiveStamp {...props} />
}
