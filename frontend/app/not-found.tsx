import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Video, Sparkles } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-8 max-w-lg w-full">

        {/* Icon cluster */}
        <div className="relative flex justify-center">
          <div className="absolute -top-6 opacity-20">
            <Sparkles className="w-20 h-20 text-primary" />
          </div>
          <AlertTriangle className="w-24 h-24 text-primary" />
        </div>

        {/* 404 */}
        <div className="text-8xl md:text-9xl font-extrabold tracking-tight text-primary">
          404
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground">
          Page Not Found
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-lg leading-relaxed">
          This page doesn’t exist, was moved, or the meeting link is no longer valid.
        </p>

        {/* Eyercall branding */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Video className="w-4 h-4" />
          <span>
            Eyercall — AI-Powered Web Conferencing Platform
          </span>
        </div>

        {/* CTA */}
        <div className="pt-2">
          <Button asChild size="lg" className="px-8">
            <Link href="/">
              Return to Dashboard
            </Link>
          </Button>
        </div>

      </div>
    </div>
  )
}
