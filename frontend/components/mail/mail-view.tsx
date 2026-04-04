"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Inbox, 
  Send, 
  Plus, 
  Search, 
  RotateCcw, 
  Loader2, 
  Mail as MailIcon, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  X,
  User,
  Calendar,
  Paperclip,
  ExternalLink
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface MailMessage {
  uid: string;
  seq: number;
  subject: string;
  from: any[];
  to: any[];
  date: string;
  flags?: string[];
  size?: number;
  snippet?: string;
}

export function MailView() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("inbox")
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(null)
  const [messageBody, setMessageBody] = useState<string | null>(null)
  const [isLoadingBody, setIsLoadingBody] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  
  const [composeData, setComposeData] = useState({
    to: "",
    subject: "",
    body: ""
  })
  const [isSending, setIsSending] = useState(false)

  const fetchMessages = useCallback(async (tab: string, forceSync = false) => {
    setIsLoading(true);
    try {
      if (tab === "inbox") {
        if (forceSync) {
           toast({ title: "Syncing Inbox", description: "Pulling new emails from external server..." });
           try {
             const syncRes = await apiService.post("/mail/sync", {});
             if (syncRes.data.count > 0) {
               toast({ title: "New Mail", description: `You have ${syncRes.data.count} new message(s).` });
             } else {
               toast({ title: "Inbox Synced", description: "Your inbox is up to date." });
             }
           } catch (e: any) {
             console.warn("IMAP Sync skipped or failed:", e?.response?.data?.error || e.message);
           }
        }
      }
      const endpoint = tab === "inbox" ? "/mail/inbox" : "/mail/sent";
      const response = await apiService.get(endpoint);
      setMessages(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      toast({
        title: "Fetch Failed",
        description: error?.response?.data?.error || "Failed to connect to mail server.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMessages(activeTab);
  }, [activeTab, fetchMessages]);

  const fetchMessageDetail = async (message: MailMessage) => {
    setSelectedMessage(message);
    setIsLoadingBody(true);
    setMessageBody(null);
    try {
      const response = await apiService.get(`/mail/${message.uid}`);
      setMessageBody(response.data.source || "No content found.");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load message body.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingBody(false);
    }
  };

  const handleSend = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      await apiService.post("/mail/send", {
        to: composeData.to,
        subject: composeData.subject,
        html: composeData.body.replace(/\n/g, '<br/>')
      });
      toast({ title: "Email Sent", description: `Message sent to ${composeData.to}` });
      setShowCompose(false);
      setComposeData({ to: "", subject: "", body: "" });
      if (activeTab === "sent") fetchMessages("sent");
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error?.response?.data?.error || "Failed to send email.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatEmailUser = (users: any[]) => {
    if (!users || users.length === 0) return "Unknown";
    const user = users[0];
    return user.name ? `${user.name} <${user.address}>` : user.address;
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* Mail List Area */}
      <Card className={cn(
        "flex flex-col border-none shadow-sm transition-all duration-300 overflow-hidden",
        selectedMessage ? "w-1/3" : "w-full"
      )}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <MailIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold tracking-tight">Mailbox</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => fetchMessages(activeTab, true)} disabled={isLoading}>
                <RotateCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <Button size="sm" className="h-8" onClick={() => setShowCompose(true)}>
                <Plus className="h-4 w-4 mr-1" /> Compose
              </Button>
            </div>
          </div>

          <div className="px-4 py-2 bg-muted/30 border-b">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="inbox" className="text-xs">
                <Inbox className="h-3 w-3 mr-1.5" /> Inbox
              </TabsTrigger>
              <TabsTrigger value="sent" className="text-xs">
                <Send className="h-3 w-3 mr-1.5" /> Sent
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-0 divide-y bg-card/50">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 opacity-50">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs font-medium">Synchronizing...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-40">
                <MailIcon className="h-8 w-8 mb-2" />
                <span className="text-sm font-medium text-balance text-center px-4">No messages found in your {activeTab}.</span>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.uid} 
                  className={cn(
                    "p-4 cursor-pointer hover:bg-muted/50 transition-all border-l-2",
                    selectedMessage?.uid === msg.uid ? "bg-indigo-500/5 border-indigo-500" : "border-transparent",
                    activeTab === 'inbox' && !msg.flags?.includes('\\Seen') && "font-bold"
                  )}
                  onClick={() => fetchMessageDetail(msg)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs text-primary truncate max-w-[150px]">
                      {activeTab === 'inbox' ? formatEmailUser(msg.from) : formatEmailUser(msg.to)}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(msg.date), "MMM d, HH:mm")}
                    </span>
                  </div>
                  <h4 className="text-sm leading-tight mb-1 truncate">{msg.subject || "(No Subject)"}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-1">{msg.snippet || "Click to view message content..."}</p>
                </div>
              ))
            )}
          </div>
        </Tabs>
      </Card>

      {/* Message Detail Area */}
      {selectedMessage && (
        <Card className="flex-1 flex flex-col border-none shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="p-4 border-b flex items-center justify-between bg-card">
            <h3 className="font-bold truncate pr-4">{selectedMessage.subject}</h3>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedMessage(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 bg-card/30">
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform hover:scale-105">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    <span className="text-muted-foreground font-normal">From:</span> {formatEmailUser(selectedMessage.from)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-normal">To:</span> {formatEmailUser(selectedMessage.to)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(selectedMessage.date), "PPP p")}
                  </div>
                </div>
              </div>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-6 bg-white dark:bg-slate-900 rounded-2xl border shadow-inner">
              {isLoadingBody ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium animate-pulse">Loading message body...</p>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: messageBody || "" }} />
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-muted/10 flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-9">
              <Trash2 className="h-4 w-4 mr-1.5 text-destructive" /> Delete
            </Button>
            <Button size="sm" className="h-9 px-6 bg-primary shadow-sm hover:shadow-md transition-all">
              Reply
            </Button>
          </div>
        </Card>
      )}

      {/* Compose Modal (Simulated Overlay) */}
      {showCompose && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-2xl border-primary/20 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex items-center justify-between bg-primary text-primary-foreground rounded-t-lg">
              <h3 className="font-bold">New Message</h3>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/20" onClick={() => setShowCompose(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">To</label>
                <Input 
                  placeholder="recipient@example.com" 
                  value={composeData.to} 
                  onChange={e => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
                <Input 
                  placeholder="Enter subject" 
                  value={composeData.subject} 
                  onChange={e => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</label>
                <textarea 
                  className="w-full min-h-[300px] p-4 rounded-xl border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none text-sm leading-relaxed" 
                  placeholder="Type your message here..."
                  value={composeData.body}
                  onChange={e => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCompose(false)}>Discard</Button>
              <Button className="px-8 shadow-indigo-200 dark:shadow-none" onClick={handleSend} disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send Email
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
