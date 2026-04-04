"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>
}

export class CRMErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("CRM Error Boundary caught an error:", error, errorInfo)
    
    // Check if it's a chunk loading error
    if (error.name === "ChunkLoadError" || error.message.includes("Loading chunk")) {
      console.warn("Chunk loading error detected, this may be due to a deployment or network issue")
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return <FallbackComponent error={this.state.error} retry={this.retry} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  const isChunkError = error?.name === "ChunkLoadError" || error?.message.includes("Loading chunk")
  
  return (
    <Card className="p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {isChunkError ? "Loading Error" : "Something went wrong"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {isChunkError 
              ? "Failed to load the CRM module. This might be due to a network issue or recent deployment."
              : "An unexpected error occurred while loading the CRM page."
            }
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={retry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && error && (
          <details className="mt-4 text-left">
            <summary className="text-sm font-medium cursor-pointer">Error Details</summary>
            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-w-md">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </Card>
  )
}
