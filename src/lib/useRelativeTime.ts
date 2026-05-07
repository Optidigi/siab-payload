"use client"
import { useEffect, useState } from "react"

export function useRelativeTime(timestamp: number | null | undefined): string | null {
  const [, tick] = useState(0)
  useEffect(() => {
    if (timestamp == null) return
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [timestamp])
  if (timestamp == null) return null
  const ms = Date.now() - timestamp
  if (ms < 60_000) return "just now"
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(timestamp).toLocaleDateString()
}
