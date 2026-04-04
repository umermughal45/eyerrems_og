"use client"

import { useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

type ImageLightboxProps = {
  images: Array<{ url: string; name?: string }>
  currentIndex: number
  open: boolean
  onClose: () => void
  onNavigate?: (index: number) => void
}

export function ImageLightbox({ images, currentIndex, open, onClose, onNavigate }: ImageLightboxProps) {
  const currentImage = images[currentIndex]
  const hasMultiple = images.length > 1

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft" && hasMultiple) {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
        onNavigate?.(prevIndex)
      } else if (e.key === "ArrowRight" && hasMultiple) {
        const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
        onNavigate?.(nextIndex)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, currentIndex, images.length, hasMultiple, onClose, onNavigate])

  if (!currentImage) return null

  const getImageUrl = (url: string) => {
    if (url.startsWith("http")) return url
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "")
    return url.startsWith("/") ? `${baseUrl}${url}` : `${baseUrl}/${url}`
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 m-0 border-0 bg-black/95">
        <DialogTitle className="sr-only">Image Viewer - {currentImage.name || "Image"}</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation Buttons */}
          {hasMultiple && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 z-50 text-white hover:bg-white/20"
                onClick={() => {
                  const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
                  onNavigate?.(prevIndex)
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 z-50 text-white hover:bg-white/20"
                onClick={() => {
                  const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
                  onNavigate?.(nextIndex)
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Image */}
          <div className="w-full h-full flex items-center justify-center p-4">
            <img
              src={getImageUrl(currentImage.url)}
              alt={currentImage.name || "Image"}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>

          {/* Image Counter */}
          {hasMultiple && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Image Name */}
          {currentImage.name && (
            <div className="absolute top-4 left-4 bg-black/50 text-white px-4 py-2 rounded text-sm max-w-md truncate">
              {currentImage.name}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

