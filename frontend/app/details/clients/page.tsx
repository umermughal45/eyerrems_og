"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, TrendingUp, Mail, Phone, Building2, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { apiService } from "@/lib/api"

type ClientWithMetrics = any & {
  totalValue?: number
  dealCount?: number
  typeLabel?: string
}

export default function ClientsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [clients, setClients] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [clientsRes, dealsRes] = await Promise.all([
          apiService.clients.getAll(undefined, { signal: controller.signal }),
          apiService.deals.getAll(undefined, { signal: controller.signal }),
        ])

        // Robust data extraction for clients
        let clientsData: any[] = []
        const clientsBody = clientsRes.data as any
        if (clientsBody?.success && Array.isArray(clientsBody?.data)) {
            clientsData = clientsBody.data
        } else if (Array.isArray(clientsBody?.data)) {
            clientsData = clientsBody.data
        } else if (Array.isArray(clientsBody)) {
            clientsData = clientsBody
        }

        // Robust data extraction for deals
        let dealsData: any[] = []
        const dealsBody = dealsRes.data as any
        if (dealsBody?.success && Array.isArray(dealsBody?.data)) {
            dealsData = dealsBody.data
        } else if (Array.isArray(dealsBody?.data)) {
            dealsData = dealsBody.data
        } else if (Array.isArray(dealsBody)) {
            dealsData = dealsBody
        }

        if (!controller.signal.aborted) {
          setClients(clientsData)
          setDeals(dealsData)
        }
      } catch (err: any) {
        if (controller.signal.aborted) return

        console.error("Failed to fetch clients page data:", err)
        const errorMessage = err.response?.data?.message || "Failed to fetch data"
        
        if (!controller.signal.aborted) {
          setError(errorMessage)
          setClients([])
          setDeals([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchData()
    return () => controller.abort()
  }, [])

  const dealStatsByClient = useMemo(() => {
    return deals.reduce<Record<string, { totalValue: number; dealCount: number }>>((acc, deal) => {
      const clientId = deal.clientId || deal.client?.id
      if (!clientId) return acc

      if (!acc[clientId]) {
        acc[clientId] = { totalValue: 0, dealCount: 0 }
      }

      const value = typeof deal.dealAmount === "number" ? deal.dealAmount : Number(deal.dealAmount) || 0
      acc[clientId].totalValue += value
      acc[clientId].dealCount += 1
      return acc
    }, {})
  }, [deals])

  const enrichedClients: ClientWithMetrics[] = useMemo(() => {
    return clients.map((client) => {
      const stats = dealStatsByClient[client.id] || { totalValue: 0, dealCount: 0 }
      const typeLabel = client.company ? "Corporate" : "Individual"
      return {
        ...client,
        totalValue: stats.totalValue,
        dealCount: stats.dealCount,
        typeLabel,
      }
    })
  }, [clients, dealStatsByClient])

  const filteredClients = useMemo(() => {
    return enrichedClients.filter((client) => {
      const query = searchQuery.toLowerCase()
      return (
        (client.name || "").toLowerCase().includes(query) ||
        (client.email || "").toLowerCase().includes(query) ||
        (client.company || "").toLowerCase().includes(query)
      )
    })
  }, [enrichedClients, searchQuery])

  const { totalClients, individualClients, corporateClients, totalValue } = useMemo(() => {
    const total = enrichedClients.length
    const corporate = enrichedClients.filter((client) => client.typeLabel === "Corporate").length
    const individual = total - corporate
    const value = enrichedClients.reduce((sum, client) => sum + (client.totalValue || 0), 0)

    return {
      totalClients: total,
      individualClients: individual,
      corporateClients: corporate,
      totalValue: value,
    }
  }, [enrichedClients])

  const typeDistribution = useMemo(() => {
    return [
      {
        name: "Individual",
        value: individualClients,
        color: "#2563eb",
      },
      {
        name: "Corporate",
        value: corporateClients,
        color: "#10b981",
      },
    ].filter((item) => item.value > 0)
  }, [individualClients, corporateClients])

  const topClients = useMemo(() => {
    return [...enrichedClients]
      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
      .slice(0, 5)
      .map((client) => ({
        name: client.name,
        company: client.company,
        value: client.totalValue || 0,
      }))
  }, [enrichedClients])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">All Clients</h1>
            <p className="text-muted-foreground mt-1">Complete overview of all clients</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Clients</p>
            <p className="text-3xl font-bold text-foreground mt-2">{totalClients}</p>
            <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>{new Date().getFullYear()}</span>
            </div>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Individual Clients</p>
            <p className="text-3xl font-bold text-foreground mt-2">{individualClients}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {totalClients === 0 ? "0" : ((individualClients / totalClients) * 100).toFixed(0)}% of total
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Corporate Clients</p>
            <p className="text-3xl font-bold text-foreground mt-2">{corporateClients}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {totalClients === 0 ? "0" : ((corporateClients / totalClients) * 100).toFixed(0)}% of total
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Deal Value</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {totalValue === 0 ? "Rs 0" : `Rs ${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Aggregated from associated deals</p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Client Distribution</h3>
            {typeDistribution.length === 0 ? (
              <p className="text-muted-foreground text-sm">No client data available for distribution.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Clients by Deal Value</h3>
            {topClients.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deal data available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topClients}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => {
                      const numericValue = typeof value === "number" ? value : Number(value ?? 0)
                      return [`Rs ${numericValue.toLocaleString("en-IN")}`, "Deal Value"]
                    }}
                    labelFormatter={(label) => {
                      const labelText = typeof label === "string" ? label : String(label ?? "")
                      const item = topClients.find((client) => client.name === labelText)
                      return item?.company ? `${labelText} (${item.company})` : labelText
                    }}
                  />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
            <h3 className="text-lg font-semibold">All Clients</h3>
            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No clients found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead className="text-right">Total Deal Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/details/clients/${client.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase">
                          {(client.name || "U")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p>{client.name}</p>
                          <Badge variant={client.typeLabel === "Corporate" ? "default" : "secondary"} className="mt-1">
                            {client.typeLabel}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{client.company || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{client.email || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{client.phone || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.dealCount ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {client.totalValue && client.totalValue > 0
                        ? `Rs ${client.totalValue.toLocaleString("en-IN")}`
                        : "Rs 0"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
