"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Props = {
  value: number
  durationMs?: number
  format?: (n: number) => string
}

export function AnimatedCounter({ value, durationMs = 900, format }: Props) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef<number>(0)

  const fmt = useMemo(() => format ?? ((n: number) => n.toLocaleString()), [format])

  useEffect(() => {
    const to = Number.isFinite(value) ? value : 0
    const from = display
    fromRef.current = from
    startRef.current = null

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const t = Math.min(1, elapsed / durationMs)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      const next = fromRef.current + (to - fromRef.current) * eased
      setDisplay(next)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs])

  return <>{fmt(display)}</>
}

