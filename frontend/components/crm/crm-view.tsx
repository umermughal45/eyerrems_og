"use client"

import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, UserPlus, TrendingUp, Plus, Briefcase, Loader2, Activity, MessageSquare, Zap } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { apiService } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { MiniChartCard } from "@/components/ui/mini-chart-card"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/permissions"

// Lazy load heavy components to reduce initial chunk size
const LeadsView = lazy(() => import("./leads-view").then(m => ({ default: m.LeadsView })))
const ClientsView = lazy(() => import("./clients-view").then(m => ({ default: m.ClientsView })))
const DealsView = lazy(() => import("./deals-view").then(m => ({ default: m.DealsView })))
const CommunicationsView = lazy(() => import("./communications-view").then(m => ({ default: m.CommunicationsView })))
const DealersView = lazy(() => import("./dealers-view").then(m => ({ default: m.DealersView })))
const CRMQuickActionsHub = lazy(() => import("@/components/crm/crm-quick-actions-hub"))

// Lazy load dialog components to reduce initial chunk size
const LeadCreationController = lazy(() => import("./lead-creation-controller").then(m => ({ default: m.LeadCreationController })))
const AddDealerDialog = lazy(() => import("./add-dealer-dialog").then(m => ({ default: m.AddDealerDialog })))
const AddClientDialog = lazy(() => import("./add-client-dialog").then(m => ({ default: m.AddClientDialog })))

export function CRMView({ initialData }: { initialData?: any }) {
  const { user } = useAuth()
  const canCreateCRM = hasPermission(user?.permissions, user?.isSuperAdmin, user?.role, "crm", "create")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showAddDealerDialog, setShowAddDealerDialog] = useState(false)
  const [showAddClientDialog, setShowAddClientDialog] = useState(false)
  const [activeTab, setActiveTabState] = useState("leads")
  const [crmStats, setCrmStats] = useState<any[]>(() => {
    if (!initialData) return []
    const data = initialData
    return [
      {
        name: "Total Leads",
        value: (data.leadsCount ?? 0).toString(),
        change: `+0 this week`, // Could calculate this too
        icon: UserPlus,
        gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
        href: "/details/leads",
      },
      {
        name: "Active Clients",
        value: (data.activeClients ?? 0).toString(),
        change: `+0 this month`,
        icon: Users,
        gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
        href: "/details/clients",
      },
      {
        name: "Deals in Pipeline",
        value: (data.dealsCount ?? 0).toString(),
        change: "Rs 0 value",
        icon: TrendingUp,
        gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
        href: "/details/deals",
      },
      {
        name: "Active Dealers",
        value: (data.totalDealers ?? 0).toString(),
        change: "Rs 0 commissions",
        icon: Briefcase,
        gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
        href: "/details/dealers",
      },
    ]
  })
  const [statsLoading, setStatsLoading] = useState(!initialData)
  const [dealersRefreshKey, setDealersRefreshKey] = useState(0)
  const [hasInitializedTab, setHasInitializedTab] = useState(false)
  const [pipelineData, setPipelineData] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.pipelineData || []
  })
  const [recentActivities, setRecentActivities] = useState<any[]>(() => {
    if (!initialData) return []
    // Map string timestamps back to Date objects if needed, but the UI might handle strings
    return (initialData.recentActivities || []).map((a: any) => ({
      ...a,
      icon: a.icon === "UserPlus" ? UserPlus : a.icon === "Users" ? Users : TrendingUp
    }))
  })
  const [leadsChartData, setLeadsChartData] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.leadsConversionData || []
  })
  const [dealsClosedData, setDealsClosedData] = useState<any[]>([])
  const tabStorageKey = "crm-active-tab"

  const updateActiveTab = useCallback(
    (value: string, { shouldPersistQuery = true }: { shouldPersistQuery?: boolean } = {}) => {
      if (value !== activeTab) {
        setActiveTabState(value)
      }

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(tabStorageKey, value)
        } catch {
          // Ignore storage errors (private mode, etc.)
        }
      }

      if (shouldPersistQuery) {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        const query = params.toString()
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
      }
    },
    [activeTab, pathname, router, searchParams, tabStorageKey],
  )

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab")
    if (tabFromQuery && tabFromQuery !== activeTab) {
      updateActiveTab(tabFromQuery, { shouldPersistQuery: false })
      if (!hasInitializedTab) {
        setHasInitializedTab(true)
      }
      return
    }

    if (!hasInitializedTab) {
      let storedTab: string | null = null
      if (typeof window !== "undefined") {
        try {
          storedTab = sessionStorage.getItem(tabStorageKey)
        } catch {
          storedTab = null
        }
      }

      if (storedTab && storedTab !== activeTab) {
        updateActiveTab(storedTab)
      } else if (!tabFromQuery) {
        updateActiveTab(activeTab)
      }

      setHasInitializedTab(true)
    }
  }, [activeTab, hasInitializedTab, searchParams, tabStorageKey, updateActiveTab])

  const handleTabChange = useCallback(
    (value: string) => {
      updateActiveTab(value)
    },
    [updateActiveTab],
  )

  useEffect(() => {
    if (!initialData) {
      fetchCRMStats()
    }
  }, [initialData])

  const fetchCRMStats = async () => {
    try {
      setStatsLoading(true)

      const [leadsRes, clientsRes, dealsRes, dealersRes, commissionsRes] = await Promise.all([
        apiService.leads.getAll().catch((error) => {
          console.error("Failed to fetch leads:", error)
          return { data: { data: [] } }
        }),
        apiService.clients.getAll().catch((error) => {
          console.error("Failed to fetch clients:", error)
          return { data: { data: [] } }
        }),
        apiService.deals.getAll().catch((error) => {
          console.error("Failed to fetch deals:", error)
          return { data: { data: [] } }
        }),
        apiService.dealers.getAll().catch((error) => {
          console.error("Failed to fetch dealers:", error)
          return { data: { data: [] } }
        }),
        apiService.commissions.getAll().catch((error) => {
          console.error("Failed to fetch commissions:", error)
          return { data: { data: [] } }
        }),
      ])

      // Handle nested response structures: { success: true, data: [...] } or { data: [...] } or axios wrapped
      const extractData = (response: any): any[] => {
        if (!response) return []

        // Handle axios response wrapper: response.data contains the actual API response
        const apiResponse = response.data || response

        // If already an array, return it
        if (Array.isArray(apiResponse)) return apiResponse

        // Handle { success: true, data: [...] } structure
        if (apiResponse?.success && Array.isArray(apiResponse.data)) {
          return apiResponse.data
        }

        // Handle { data: [...] } structure (nested data)
        if (apiResponse?.data && Array.isArray(apiResponse.data)) {
          return apiResponse.data
        }

        // Handle direct { data: [...] } on response
        if (response.data && Array.isArray(response.data)) {
          return response.data
        }

        return []
      }

      const leads: any[] = extractData(leadsRes as any)
      const clients: any[] = extractData(clientsRes as any)
      const deals: any[] = extractData(dealsRes as any)
      const dealers: any[] = extractData(dealersRes as any)
      const commissions: any[] = extractData(commissionsRes as any)

      // Debug logging (can be removed later)
      console.log('CRM Stats Data:', {
        leadsCount: leads.length,
        clientsCount: clients.length,
        dealsCount: deals.length,
        dealersCount: dealers.length,
      })

      const now = new Date()
      const weekAgo = new Date(now)
      weekAgo.setDate(now.getDate() - 7)
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      const leadsThisWeek = leads.filter((lead) => {
        if (!lead.createdAt) return false
        const created = new Date(lead.createdAt)
        return !Number.isNaN(created.valueOf()) && created >= weekAgo
      }).length

      const activeClientsCount = clients.filter(
        (client) => (client.status || "").toLowerCase() === "active",
      ).length

      const clientsThisMonth = clients.filter((client) => {
        if (!client.createdAt) return false
        const created = new Date(client.createdAt)
        return !Number.isNaN(created.valueOf()) && created >= startOfThisMonth
      }).length

      const closedStages = new Set(["closed-won", "won", "closed-lost", "lost"])
      const pipelineDeals = deals.filter((deal) => {
        const stage = (deal.stage || "").toLowerCase()
        return stage === "" || !closedStages.has(stage)
      })

      const pipelineValue = pipelineDeals.reduce((sum, deal) => {
        const numericValue = typeof deal.dealAmount === "number" ? deal.dealAmount : Number(deal.dealAmount)
        return sum + (Number.isFinite(numericValue) ? numericValue : 0)
      }, 0)

      const totalCommissions = commissions.reduce((sum, item) => {
        const numericValue = typeof item.amount === "number" ? item.amount : Number(item.amount)
        return sum + (Number.isFinite(numericValue) ? numericValue : 0)
      }, 0)

      // Calculate pipeline funnel data
      const pipelineStages = {
        new: leads.filter((l) => (l.status || "").toLowerCase() === "new").length,
        qualified: leads.filter((l) => (l.status || "").toLowerCase() === "qualified").length,
        proposal: deals.filter((d) => (d.stage || "").toLowerCase() === "proposal").length,
        negotiation: deals.filter((d) => (d.stage || "").toLowerCase() === "negotiation").length,
        closing: deals.filter((d) => {
          const stage = (d.stage || "").toLowerCase()
          return stage === "closing" || stage === "closed-won"
        }).length,
      }

      setPipelineData([
        { stage: "New", count: pipelineStages.new, color: "#3b82f6" },
        { stage: "Qualified", count: pipelineStages.qualified, color: "#8b5cf6" },
        { stage: "Proposal", count: pipelineStages.proposal, color: "#f59e0b" },
        { stage: "Negotiation", count: pipelineStages.negotiation, color: "#ef4444" },
        { stage: "Closing", count: pipelineStages.closing, color: "#10b981" },
      ])

      // Mock mini chart data
      setLeadsChartData([
        { name: "Converted", value: clients.length },
        { name: "Pending", value: leads.length - clients.length > 0 ? leads.length - clients.length : Math.floor(leads.length * 0.4) }
      ])

      const closedDeals = deals.filter((d: any) =>
        (d.stage || d.status || "").toLowerCase().includes("clos") ||
        (d.stage || d.status || "").toLowerCase().includes("won")
      );
      const recentMonths = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return {
          month: d.toLocaleString('default', { month: 'short' }),
          deals: 0,
          year: d.getFullYear(),
          monthNum: d.getMonth()
        };
      });

      closedDeals.forEach((deal: any) => {
        const dDate = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt);
        if (isNaN(dDate.getTime())) return;
        const match = recentMonths.find(m => m.monthNum === dDate.getMonth() && m.year === dDate.getFullYear());
        if (match) match.deals++;
      });
      setDealsClosedData(recentMonths.map(m => ({ month: m.month, deals: m.deals })));

      // Build recent activities feed
      const activities: any[] = []

      // Add recent leads
      leads.slice(0, 5).forEach((lead) => {
        if (lead.createdAt) {
          activities.push({
            id: `lead-${lead.id}`,
            type: "lead",
            action: "created",
            title: `New lead: ${lead.name}`,
            timestamp: lead.createdAt,
            icon: UserPlus,
          })
        }
      })

      // Add recent clients
      clients.slice(0, 5).forEach((client) => {
        if (client.createdAt) {
          activities.push({
            id: `client-${client.id}`,
            type: "client",
            action: "created",
            title: `New client: ${client.name}`,
            timestamp: client.createdAt,
            icon: Users,
          })
        }
      })

      // Add recent deals
      deals.slice(0, 5).forEach((deal) => {
        if (deal.updatedAt || deal.createdAt) {
          activities.push({
            id: `deal-${deal.id}`,
            type: "deal",
            action: deal.updatedAt && new Date(deal.updatedAt) > new Date(deal.createdAt) ? "updated" : "created",
            title: `Deal ${deal.updatedAt && new Date(deal.updatedAt) > new Date(deal.createdAt) ? "updated" : "created"}: ${deal.title}`,
            timestamp: deal.updatedAt || deal.createdAt,
            icon: TrendingUp,
          })
        }
      })

      // Sort by timestamp and take latest 10
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setRecentActivities(activities.slice(0, 10))

      setCrmStats([
        {
          name: "Total Leads",
          value: leads.length.toString(),
          change: `+${leadsThisWeek} this week`,
          icon: UserPlus,
          gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
          href: "/details/leads",
        },
        {
          name: "Active Clients",
          value: activeClientsCount.toString(),
          change: `+${clientsThisMonth} this month`,
          icon: Users,
          gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
          href: "/details/clients",
        },
        {
          name: "Deals in Pipeline",
          value: pipelineDeals.length.toString(),
          change: pipelineValue > 0 ? `${formatCurrency(pipelineValue, undefined, 'compact')} value` : `${formatCurrency(0)} value`,
          icon: TrendingUp,
          gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
          href: "/details/deals",
        },
        {
          name: "Active Dealers",
          value: dealers.length.toString(),
          change: totalCommissions > 0 ? `${formatCurrency(totalCommissions, undefined, 'compact')} commissions` : `${formatCurrency(0)} commissions`,
          icon: Briefcase,
          gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
          href: "/details/dealers",
        },
      ])
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return
      }
      console.error("Failed to fetch CRM stats:", err)
      setCrmStats([])
    } finally {
      setStatsLoading(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground text-balance">CRM</h1>
          <p className="text-muted-foreground mt-1">Manage leads, clients, deals, dealers, and communications</p>
        </div>
        <div className="flex gap-2">
          {canCreateCRM && (
            <>
              {activeTab === "dealers" ? (
                <Button onClick={() => setShowAddDealerDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dealer
                </Button>
              ) : activeTab === "clients" ? (
                <Button onClick={() => setShowAddClientDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              ) : (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* CRM Stats */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {crmStats.map((stat) => (
            <Card
              key={stat.name}
              className={cn(
                "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] cursor-pointer p-0",
              )}
              onClick={() => router.push(stat.href)}
            >
              <div className="relative p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br",
                    stat.gradient
                  )}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-slate-200 bg-slate-50 text-slate-600 shadow-sm dark:bg-[#1a3442] dark:text-white dark:ring-white/10",
                    )}
                  >
                    {stat.change}
                  </span>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.name}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Mini Charts Row */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <MiniChartCard
          title="Leads vs Converted"
          value={leadsChartData.find(d => d.name === "Converted")?.value || 0}
          valueSuffix={` / ${(leadsChartData.find(d => d.name === "Converted")?.value || 0) + (leadsChartData.find(d => d.name === "Pending")?.value || 0)}`}
          data={leadsChartData}
          dataKey="value"
          nameKey="name"
          chartType="pie"
          colors={["#10b981", "#f59e0b"]}
        />
        <MiniChartCard
          title="Sales Pipeline"
          value={pipelineData.reduce((acc, curr) => acc + curr.count, 0)}
          data={pipelineData}
          dataKey="count"
          nameKey="stage"
          chartType="bar"
          colors={["#8b5cf6"]}
        />
        <MiniChartCard
          title="Monthly Deals Closed"
          value={dealsClosedData.length > 0 ? dealsClosedData[5]?.deals : 0}
          data={dealsClosedData}
          dataKey="deals"
          chartType="line"
          colors={["#3b82f6"]}
          trend={{ value: 15.5 }}
        />
      </div>

      {/* Pipeline Funnel Chart and Recent Activities */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Funnel Chart */}
        <Card className="p-6 bg-white dark:bg-[#0d212c] border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Sales Pipeline Funnel</h3>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-400">Live</Badge>
          </div>
          {pipelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="dark:opacity-50" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis
                  dataKey="stage"
                  type="category"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f8fafc"
                  }}
                  itemStyle={{ color: "#f8fafc" }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value: any) => [`${value}`, "Count"]}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                  {pipelineData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No pipeline data available
            </div>
          )}
        </Card>

        {/* Recent Activities Feed */}
        <Card className="p-6 bg-white dark:bg-[#0d212c] border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activities</h3>
            <Activity className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>
          <ScrollArea className="h-[300px]">
            {recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <activity.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{activity.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {activity.type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No recent activities</p>
                <p className="text-xs text-muted-foreground mt-1">Activities will appear here as you work</p>
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="dealers">Dealers</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="quick-actions" className="gap-2">
            <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
            Quick Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <LeadsView />
          </Suspense>
        </TabsContent>

        <TabsContent value="clients">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <ClientsView />
          </Suspense>
        </TabsContent>

        <TabsContent value="deals">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <DealsView />
          </Suspense>
        </TabsContent>

        <TabsContent value="dealers">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <DealersView refreshKey={dealersRefreshKey} />
          </Suspense>
        </TabsContent>

        <TabsContent value="communications">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <CommunicationsView />
          </Suspense>
        </TabsContent>

        <TabsContent value="quick-actions">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <CRMQuickActionsHub />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Suspense fallback={null}>
        <LeadCreationController open={showAddDialog} onOpenChange={setShowAddDialog} />
      </Suspense>
      <Suspense fallback={null}>
        <AddDealerDialog
          open={showAddDealerDialog}
          onOpenChange={setShowAddDealerDialog}
          onSuccess={() => setDealersRefreshKey((key) => key + 1)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <AddClientDialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog} />
      </Suspense>
    </div>
  )
}
