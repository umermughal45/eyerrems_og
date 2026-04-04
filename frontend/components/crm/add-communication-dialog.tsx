"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface CommunicationFormData {
  id?: string
  clientId?: string | null
  channel?: string
  content?: string
  createdAt?: string
}

interface AddCommunicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialData?: CommunicationFormData | null
  mode?: "create" | "edit"
}

type ClientOption = {
  id: string
  name: string
}

const defaultFormState = {
  clientId: "",
  type: "email",
  subject: "",
  message: "",
  date: "",
}

const parseContent = (content?: string) => {
  if (!content) {
    return { subject: "", message: "" }
  }
  const [firstLine, ...rest] = content.split("\n")
  return {
    subject: firstLine || "",
    message: rest.join("\n").trim(),
  }
}

export function AddCommunicationDialog({
  open,
  onOpenChange,
  onSuccess,
  initialData = null,
  mode = "create",
}: AddCommunicationDialogProps) {
  const [formData, setFormData] = useState(defaultFormState)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const isEdit = mode === "edit" && initialData?.id

  const parsedInitialContent = useMemo(() => parseContent(initialData?.content), [initialData?.content])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()

    const loadClients = async () => {
      try {
        setLoadingClients(true)
        const response: any = await apiService.clients.getAll(undefined, { signal: controller.signal })
        const responseData = response.data as any
        const data = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
        const options = Array.isArray(data) ? data.map((client: any) => ({
          id: client.id,
          name: client.name,
        })) : []

        if (!controller.signal.aborted) {
          setClients(options)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("Failed to load clients", error)
        toast({ title: "Failed to load clients", variant: "destructive" })
      } finally {
        if (!controller.signal.aborted) {
          setLoadingClients(false)
        }
      }
    }

    loadClients()
    return () => controller.abort()
  }, [open, toast])

  useEffect(() => {
    if (open) {
      if (isEdit && initialData) {
        setFormData({
          clientId: initialData.clientId || "",
          type: initialData.channel || "email",
          subject: parsedInitialContent.subject,
          message: parsedInitialContent.message,
          date: initialData.createdAt ? new Date(initialData.createdAt).toISOString().split("T")[0] : "",
        })
      } else {
        setFormData(defaultFormState)
      }
    }
  }, [open, isEdit, initialData, parsedInitialContent])

  const resetForm = () => {
    setFormData(defaultFormState)
    setSubmitting(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const createdAt = formData.date ? new Date(formData.date) : new Date()
      const payload = {
        clientId: formData.clientId || null,
        channel: formData.type,
        content: `${formData.subject}\n\n${formData.message}`.trim(),
      } as any

      if (isEdit) {
        await apiService.communications.update(initialData!.id!, {
          ...payload,
          createdAt: createdAt.toISOString(),
        })
        toast({ title: "Communication updated" })
      } else {
        await apiService.communications.create({ ...payload, createdAt: createdAt.toISOString() })
        toast({ title: "Communication logged" })
      }

      onOpenChange(false)
      resetForm()
      onSuccess?.()
    } catch (err: any) {
      console.error("Failed to save communication", err)
      toast({ title: `Failed to ${isEdit ? "update" : "add"} communication`, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Communication" : "Add Communication"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the communication log" : "Log a new communication with a client"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="clientId">Client</Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                disabled={loadingClients}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingClients ? "Loading clients..." : "Select client"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && !loadingClients ? (
                    <SelectItem value="none-available" disabled>
                      No clients available
                    </SelectItem>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Communication Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Communication subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message/Notes</Label>
              <Textarea
                id="message"
                placeholder="Communication details"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || (loadingClients && clients.length === 0)}>
              {submitting ? "Saving..." : isEdit ? "Save Changes" : "Add Communication"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
