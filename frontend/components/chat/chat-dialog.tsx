"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

interface Message {
  id: string
  content: string
  senderId: string
  senderName: string
  senderEmail?: string
  senderRole: string
  createdAt: string
}

interface ChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNewMessage?: () => void
}

// Role color mapping
const getRoleColor = (role: string): { bg: string; text: string; border: string } => {
  const roleLower = role.toLowerCase()
  
  if (roleLower === 'admin') {
    return {
      bg: 'bg-primary',
      text: 'text-primary-foreground',
      border: 'border-primary'
    }
  } else if (roleLower.includes('hr') || roleLower === 'hr manager') {
    return {
      bg: 'bg-green-500',
      text: 'text-white',
      border: 'border-green-500'
    }
  } else if (roleLower === 'accountant') {
    return {
      bg: 'bg-gray-500',
      text: 'text-white',
      border: 'border-gray-500'
    }
  } else if (roleLower === 'dealer' || roleLower === 'sales') {
    return {
      bg: 'bg-orange-500',
      text: 'text-white',
      border: 'border-orange-500'
    }
  } else if (roleLower === 'tenant') {
    return {
      bg: 'bg-cyan-500',
      text: 'text-white',
      border: 'border-cyan-500'
    }
  } else {
    // Custom roles - purple
    return {
      bg: 'bg-purple-500',
      text: 'text-white',
      border: 'border-purple-500'
    }
  }
}

export function ChatDialog({ open, onOpenChange, onNewMessage }: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)
  const lastMessageIdRef = useRef<string | null>(null)
  const isInitialLoadRef = useRef(true)
  const hasShownErrorRef = useRef(false) // Track if we've shown an error to avoid spam

  // Fetch messages
  const fetchMessages = async (isInitialLoad = false) => {
    try {
      // Only set loading on initial fetch, not on polling
      if (isInitialLoad) {
        setLoading(true)
      }
      const response: any = await apiService.chat.getMessages()
      const responseData = response.data as any
      const messagesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setMessages(Array.isArray(messagesData) ? messagesData : [])
      // Reset error flag on success
      hasShownErrorRef.current = false
    } catch (err: any) {
      // Only show errors on initial load, silently handle polling errors
      if (isInitialLoad && !hasShownErrorRef.current) {
        // Check if it's a network error
        const isNetworkError = !err.response && (
          err.message?.includes('Network Error') || 
          err.code === 'ECONNREFUSED' || 
          err.code === 'ERR_NETWORK' || 
          err.code === 'ERR_CONNECTION_REFUSED' ||
          err.message?.includes('ERR_CONNECTION_REFUSED')
        )
        
        if (isNetworkError) {
          // Suppress console error for network errors - they're expected if backend is down
          // Only show toast if chat is actually open and we haven't shown error yet
          if (open) {
            hasShownErrorRef.current = true
            toast({
              title: "Chat Unavailable",
              description: "Chat server is not available. The chat feature may be disabled.",
              variant: "destructive",
            })
          }
        } else {
          // Only log non-network errors once
          if (!hasShownErrorRef.current) {
            console.error("Failed to fetch messages:", err)
            hasShownErrorRef.current = true
            if (open) {
              toast({
                title: "Error",
                description: err?.response?.data?.message || err?.message || "Failed to load messages",
                variant: "destructive",
              })
            }
          }
        }
      }
      // Silently ignore polling errors - don't log or show toast
    } finally {
      setLoading(false)
    }
  }

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!newMessage.trim() || !user) return

    try {
      setSending(true)
      const response: any = await apiService.chat.sendMessage({
        content: newMessage.trim(),
      }).catch((err: any) => {
        // Prevent default error handling from causing redirects
        if (err.response?.status === 401) {
          // Don't let the interceptor redirect - handle it here
          throw new Error("Session expired. Please refresh the page.")
        }
        throw err
      })
      
      // Add new message to the list
      const responseData = response.data as any
      const messageData = responseData?.data || responseData
      if (messageData) {
        setMessages((prev) => [...prev, messageData])
        setNewMessage("")
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }
    } catch (err: any) {
      console.error("Failed to send message:", err)
      // Only show toast, don't let error propagate to cause redirects
      const errorMessage = err.message || err.response?.data?.message || "Failed to send message"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      // Prevent page reload
      e.preventDefault()
      e.stopPropagation()
    } finally {
      setSending(false)
    }
  }

  // Fetch messages when dialog opens
  useEffect(() => {
    if (open) {
      // Initial fetch when dialog opens
      isInitialLoadRef.current = true
      fetchMessages(true)
    }
  }, [open])

  // Poll for new messages only when chat dialog is open (every 5 seconds)
  useEffect(() => {
    if (!open) return // Don't poll when chat is closed

    const interval = setInterval(() => {
      fetchMessages(false) // Pass false to indicate this is a polling request
    }, 5000) // Increased to 5 seconds to reduce server load

    return () => clearInterval(interval)
  }, [open]) // Only depend on open state

  // Reset initial load flag when dialog opens
  useEffect(() => {
    if (open) {
      isInitialLoadRef.current = true
      fetchMessages()
    }
  }, [open])

  // Detect new messages and notify parent
  useEffect(() => {
    if (messages.length === 0) {
      lastMessageCountRef.current = 0
      lastMessageIdRef.current = null
      isInitialLoadRef.current = true
      return
    }

    // Get the latest message
    const latestMessage = messages[messages.length - 1]
    
    // Skip if this is the initial load
    if (isInitialLoadRef.current) {
      lastMessageCountRef.current = messages.length
      lastMessageIdRef.current = latestMessage.id
      isInitialLoadRef.current = false
      return
    }

    // Check if there's a new message (different ID or count increased)
    const hasNewMessage = latestMessage.id !== lastMessageIdRef.current || messages.length > lastMessageCountRef.current
    
    if (hasNewMessage) {
      // Only notify if the new message is NOT from the current user
      // (don't show red dot for messages sent by the current user)
      if (latestMessage.senderId !== user?.id) {
        // New message arrived from another user - notify parent
        onNewMessage?.()
      }
    }
    
    lastMessageCountRef.current = messages.length
    lastMessageIdRef.current = latestMessage.id
  }, [messages, onNewMessage, user?.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
  }, [messages, open])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return "Just now"
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours}h ago`
    }

    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw] h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Team Chat</DialogTitle>
          <DialogDescription>
            Chat with all active team members
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden px-6">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="space-y-4 pb-4">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.senderId === user?.id
                const roleColor = getRoleColor(isOwnMessage ? (user?.role || message.senderRole) : message.senderRole)
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 border ${
                        isOwnMessage
                          ? `${roleColor.bg} ${roleColor.text} ${roleColor.border}`
                          : `${roleColor.bg} ${roleColor.text} ${roleColor.border} opacity-90`
                      }`}
                    >
                      {!isOwnMessage && (
                        <div className={`text-xs font-semibold mb-1 ${roleColor.text} opacity-90`}>
                          {message.senderRole.toLowerCase() === 'admin' 
                            ? `Admin (${message.senderEmail || message.senderName})`
                            : `${message.senderRole} (${message.senderName})`}
                        </div>
                      )}
                      {isOwnMessage && (
                        <div className={`text-xs font-semibold mb-1 ${roleColor.text} opacity-90`}>
                          {user?.role?.toLowerCase() === 'admin'
                            ? `Admin (${user?.email || message.senderName})`
                            : `${user?.role || message.senderRole} (${user?.username || message.senderName})`}
                        </div>
                      )}
                      <div className={`text-sm ${roleColor.text}`}>{message.content}</div>
                      <div className={`text-xs mt-1 ${roleColor.text} opacity-80`}>
                        {formatTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        <form onSubmit={sendMessage} className="flex gap-2 px-6 pb-6 pt-4 border-t" noValidate>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending || !user}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !newMessage.trim() || !user}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

