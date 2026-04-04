"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Send, Calendar, Loader2, Trash2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

export function MessagesView({ tenantData }: { tenantData: any }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showCompose, setShowCompose] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    fetchMessages()
  }, [tenantData])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      const res = await apiService.chat.getMessages()
      const allMessages = Array.isArray((res as any)?.data?.data)
        ? (res as any).data.data
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : []
      
      // Filter out maintenance requests (they're handled separately)
      const regularMessages = allMessages.filter((msg: any) => {
        const content = msg.content || ""
        return !content.startsWith("[MAINTENANCE]") && !content.startsWith("[MAINTENANCE-UPDATE]")
      })
      
      // Show recent messages (most recent first)
      setMessages(regularMessages.slice(0, 20).reverse())
    } catch (error) {
      console.error("Error fetching messages:", error)
      setMessages([])
      toast({
        title: "Error",
        description: "Failed to load messages.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return
    }

    try {
      await apiService.chat.deleteMessage(messageId)
      
      toast({
        title: "Message Deleted",
        description: "The message has been deleted successfully.",
      })
      
      // Refresh messages
      await fetchMessages()
    } catch (error: any) {
      console.error("Error deleting message:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to delete message. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReply = (messageId: string, originalSender: string) => {
    setReplyingTo(messageId)
    setReplyContent("")
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim() || !replyingTo) return

    try {
      setSending(true)
      
      // Find the original message to include context
      const originalMessage = messages.find((m: any) => m.id === replyingTo)
      const originalSender = originalMessage?.senderName || "Admin"
      
      // Format reply with context
      const replyText = `Re: ${originalMessage?.content || "Message"}\n\n${replyContent}`
      
      await apiService.chat.sendMessage({ content: replyText })
      
      toast({
        title: "Reply Sent",
        description: "Your reply has been sent successfully.",
      })
      
      // Reset form and refresh messages
      setReplyingTo(null)
      setReplyContent("")
      await fetchMessages()
    } catch (error: any) {
      console.error("Error sending reply:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to send reply. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleSendNewMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const subject = formData.get("subject") as string
    const message = formData.get("message") as string

    if (!message?.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a message.",
        variant: "destructive",
      })
      return
    }

    try {
      setSending(true)
      
      const messageText = subject ? `Subject: ${subject}\n\n${message}` : message
      
      await apiService.chat.sendMessage({ content: messageText })
      
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      })
      
      // Reset form and refresh messages
      form.reset()
      setShowCompose(false)
      await fetchMessages()
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to send message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Messages</h2>
          <p className="text-sm text-muted-foreground mt-1">Communicate with property management</p>
        </div>
        <Button onClick={() => setShowCompose(!showCompose)}>
          <Send className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      {/* Compose Message */}
      {showCompose && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Compose Message</h3>
          <form onSubmit={handleSendNewMessage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                name="subject"
                type="text"
                placeholder="Message subject (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea 
                id="message"
                name="message"
                placeholder="Type your message here..." 
                rows={4}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCompose(false)}
                disabled={sending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Reply Form */}
      {replyingTo && (
        <Card className="p-6 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Reply to Message</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReplyingTo(null)
                setReplyContent("")
              }}
            >
              Cancel
            </Button>
          </div>
          <form onSubmit={handleSendReply} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reply">Your Reply</Label>
              <Textarea
                id="reply"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your reply here..."
                rows={4}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={sending || !replyContent.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Messages List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : messages.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-center">No messages available.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg: any) => {
            // Handle different message structures
            const senderName = msg.senderName || msg.from || "Unknown"
            const senderRole = msg.senderRole || msg.role || "User"
            const content = msg.content || msg.message || ""
            const date = msg.createdAt || msg.date || new Date().toISOString()
            const subject = msg.subject || "Message"
            
            // Get initials for avatar
            const getInitials = (name: string) => {
              if (!name || typeof name !== 'string') return "?"
              const parts = name.split(" ").filter(Boolean)
              if (parts.length === 0) return "?"
              if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?"
              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            }
            
            return (
              <Card key={msg.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {getInitials(senderName)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{subject}</h3>
                        {msg.status === "unread" && <Badge variant="default">New</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium">{senderName}</span>
                        <span>•</span>
                        <span>{senderRole}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(date).toLocaleDateString()}
                  </div>
                </div>
                <p className="text-sm text-foreground pl-13 whitespace-pre-wrap">{content}</p>
                <div className="flex gap-2 mt-4 pl-13">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleReply(msg.id, senderName)}
                    disabled={replyingTo === msg.id || sending}
                  >
                    {replyingTo === msg.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Replying...
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1" />
                        Reply
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMessage(msg.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
