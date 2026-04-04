"use client"

import type React from "react"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HelpCircle, MessageSquare, Book, Video, Mail, Phone, Search, ChevronRight, FileText } from "lucide-react"
import { useSettingsStore } from "@/lib/store/settings-store"

const faqs = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "How do I add a new property?",
        a: "Navigate to Properties > Add Property button to create a new property listing.",
      },
      {
        q: "How do I create an invoice?",
        a: "Go to Finance > Invoices > Create Invoice to generate a new invoice for tenants.",
      },
      { q: "How do I add tenants?", a: "Visit Properties > Tenants tab and click Add Tenant to register new tenants." },
    ],
  },
  {
    category: "Property Management",
    questions: [
      {
        q: "How do I track property sales?",
        a: "Use the Properties > Sales tab to record and track all property sales transactions.",
      },
      {
        q: "How do I manage lease agreements?",
        a: "Navigate to Properties > Leases to create, view, and manage all lease agreements.",
      },
      {
        q: "How do I handle maintenance requests?",
        a: "Tenants can submit requests via Tenant Portal, which appear in your dashboard.",
      },
    ],
  },
  {
    category: "Financial Management",
    questions: [
      {
        q: "How do I generate financial reports?",
        a: "Go to Finance > Reports to view and export various financial reports and analytics.",
      },
      {
        q: "How do I download invoice PDFs?",
        a: "Click the download icon next to any invoice to generate and download a PDF.",
      },
      {
        q: "How do I record payments?",
        a: "Navigate to Finance > Payments and click Add Payment to record tenant payments.",
      },
    ],
  },
]

export function SupportView() {
  const { companyName, companyEmail, supportPhone } = useSettingsStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "",
    priority: "",
    description: "",
  })

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Support ticket submitted:", ticketForm)
  }

  const displayName = companyName || "RealEstate ERP"
  const displayEmail = companyEmail || "support@realestate.com"
  const displayPhone = supportPhone || "(555) 123-4567"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground text-balance">Help & Support</h1>
        <p className="text-muted-foreground mt-1">Get help with {displayName}</p>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Email Support</h3>
              <p className="text-sm text-muted-foreground">{displayEmail}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <Phone className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Phone Support</h3>
              <p className="text-sm text-muted-foreground">{displayPhone}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Live Chat</h3>
              <p className="text-sm text-muted-foreground">Available 9AM-5PM EST</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList>
          <TabsTrigger value="faq">
            <HelpCircle className="h-4 w-4 mr-2" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="documentation">
            <Book className="h-4 w-4 mr-2" />
            Documentation
          </TabsTrigger>
          <TabsTrigger value="videos">
            <Video className="h-4 w-4 mr-2" />
            Video Tutorials
          </TabsTrigger>
          <TabsTrigger value="ticket">
            <MessageSquare className="h-4 w-4 mr-2" />
            Submit Ticket
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search frequently asked questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {faqs.map((category, idx) => (
            <Card key={idx} className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">{category.category}</h3>
              <div className="space-y-4">
                {category.questions.map((item, qIdx) => (
                  <div key={qIdx} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">{item.q}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{item.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="documentation" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Documentation</h3>
            <div className="space-y-3">
              {["User Guide", "Property Management Guide", "Financial Module Guide", "HR Management Guide", "CRM Guide", "API Documentation"].map((guide) => (
                <Button key={guide} variant="outline" className="w-full justify-between bg-transparent">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {guide}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: `Getting Started with ${displayName}`, desc: "Learn the basics in 10 minutes" },
              { title: "Property Management Tutorial", desc: "Complete property management walkthrough" },
              { title: "Financial Management", desc: "Managing invoices and payments" },
              { title: "Advanced Features", desc: "Unlock the full potential of the system" },
            ].map((video) => (
              <Card key={video.title} className="p-6">
                <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center">
                  <Video className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground">{video.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{video.desc}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ticket">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Submit Support Ticket</h3>
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    placeholder="e.g., Property Management"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    placeholder="Low, Medium, High"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  placeholder="Please provide detailed information about your issue..."
                  rows={6}
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto text-white bg-[#315341] hover:bg-[#2a4738]">
                Submit Ticket
              </Button>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
