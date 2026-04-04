"use client"

import { useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Download, ZoomIn, ZoomOut, RotateCw } from "lucide-react"

type DocumentViewerProps = {
  open: boolean
  onClose: () => void
  document: {
    id?: string
    url: string
    name: string
    fileType: string
  } | null
}

export function DocumentViewer({ open, onClose, document: doc }: DocumentViewerProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!doc) return null

  const getDocumentUrl = (url: string) => {
    // If it's already a full URL, return it
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    
    // Handle secure-files paths: /secure-files/... or /api/secure-files/...
    if (url.startsWith("/secure-files/") || url.startsWith("/api/secure-files/")) {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "")
      const cleanPath = url.replace(/^\/api/, '')
      return `${baseUrl}/api${cleanPath}`
    }
    
    // Handle /api/files paths
    if (url.startsWith("/api/files")) {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "")
      return `${baseUrl}${url}`
    }

    // Legacy fallback for other relative paths
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "")
    return url.startsWith("/") ? `${baseUrl}${url}` : `${baseUrl}/${url}`
  }

  const isImage = doc.fileType?.startsWith('image/')
  const isPDF = doc.fileType === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf')

  const handleDownload = () => {
    // Check if we can construct a download URL from the view URL
    let downloadUrl = getDocumentUrl(doc.url)
    if (downloadUrl.includes('/view/')) {
        downloadUrl = downloadUrl.replace('/view/', '/download/')
    }
    
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = doc.name
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderDocument = () => {
    const documentUrl = getDocumentUrl(doc.url)

    if (isImage) {
      return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <img
            src={documentUrl}
            alt={doc.name}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        </div>
      )
    }

    if (isPDF) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <iframe
            src={`${documentUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full border-0"
            title={doc.name}
          />
        </div>
      )
    }

    // Fallback for unsupported file types
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-lg text-gray-600 mb-4">Preview not available for this file type</p>
          <Button onClick={handleDownload} className="mx-auto">
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 m-0">
        <DialogTitle className="sr-only">Document Viewer - {doc.name}</DialogTitle>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate" title={doc.name}>
              {doc.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {doc.fileType || 'Unknown type'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              title="Download file"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close viewer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 w-full h-full overflow-hidden">
          {renderDocument()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
