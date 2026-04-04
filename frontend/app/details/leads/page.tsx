"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Mail, Phone, MapPin, Calendar, TrendingUp, Users, Target, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"

export default function LeadsDetailsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiService.leads.getAll()
        const data = Array.isArray(response.data) ? response.data : []
        setLeads(data)
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to fetch leads")
        setLeads([])
      } finally {
        setLoading(false)
      }
    }
    fetchLeads()
  }, [])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) =>
      (lead.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [leads, searchQuery])

  const totalLeads = leads.length
  const newLeads = leads.filter((l) => (l.status || "").toLowerCase() === "new").length
  const qualifiedLeads = leads.filter((l) => (l.status || "").toLowerCase() === "qualified").length
  const conversionRate = totalLeads === 0 ? "0.0" : ((qualifiedLeads / totalLeads) * 100).toFixed(1)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">All Leads</h1>
            <p className="text-muted-foreground">Complete lead database and conversion analytics</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New Leads</p>
                <p className="text-2xl font-bold text-foreground">{newLeads}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Qualified</p>
                <p className="text-2xl font-bold text-foreground">{qualifiedLeads}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion</p>
                <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Leads Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">{error}</div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No leads found</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{lead.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={
                          (lead.status || "").toLowerCase() === "new"
                            ? "secondary"
                            : (lead.status || "").toLowerCase() === "qualified"
                              ? "default"
                              : (lead.status || "").toLowerCase() === "negotiation"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {lead.status || "—"}
                      </Badge>
                      {!!lead.source && <Badge variant="outline">{lead.source}</Badge>}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{lead.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{lead.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{lead.interest || lead.location || "—"}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Interest</p>
                      <p className="font-medium text-foreground mt-1">{lead.interest || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-medium text-foreground mt-1">{lead.budget || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Assigned To</p>
                      <p className="font-medium text-foreground mt-1">{lead.assignedTo || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium text-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
