"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Hammer, Plus, Loader2, Building2, FileText, Users, Wrench, Package, TrendingUp } from "lucide-react"
import { apiService } from "@/lib/api"
import { ProjectsView } from "./projects-view"
import { CostCodesView } from "./cost-codes-view"
import { DailyLogsView } from "./daily-logs-view"
import { LaborView } from "./labor-view"
import { EquipmentView } from "./equipment-view"
import { InventoryView } from "./inventory-view"
import { ReportsView } from "./reports-view"
import { AddProjectDialog } from "./add-project-dialog"
import { cn } from "@/lib/utils"

export function ConstructionView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [activeTab, setActiveTabState] = useState("projects")
  const [hasInitializedTab, setHasInitializedTab] = useState(false)
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalCost: 0,
    pendingApprovals: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const tabStorageKey = "construction-active-tab"

  const updateActiveTab = useCallback(
    (value: string, { shouldPersistQuery = true }: { shouldPersistQuery?: boolean } = {}) => {
      if (value !== activeTab) {
        setActiveTabState(value)
      }

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(tabStorageKey, value)
        } catch {
          // Ignore storage errors
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
  }, [activeTab, hasInitializedTab, searchParams, updateActiveTab])

  const handleTabChange = useCallback(
    (value: string) => {
      updateActiveTab(value)
    },
    [updateActiveTab],
  )

  useEffect(() => {
    fetchStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const response = await apiService.construction.projects.getAll({ limit: 1000 })
      const responseData = response.data as any
      const projects = responseData?.data || responseData || []
      const active = projects.filter((p: any) => p.status === "active")
      const totalCost = projects.reduce((sum: number, p: any) => sum + (p.actualCost || 0), 0)

      setStats({
        totalProjects: projects.length,
        activeProjects: active.length,
        totalCost,
        pendingApprovals: 0, // TODO: Calculate from labor/equipment/issue approvals
      })
    } catch (error) {
      console.error("Error fetching construction stats:", error)
    } finally {
      setStatsLoading(false)
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    const numericValue = Number(amount || 0)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericValue)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Hammer className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Construction</h1>
            <p className="text-sm text-muted-foreground">Project-based construction operations</p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            name: "Total Projects",
            value: statsLoading ? null : stats.totalProjects,
            icon: Building2,
            gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
          },
          {
            name: "Active Projects",
            value: statsLoading ? null : stats.activeProjects,
            icon: TrendingUp,
            gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
          },
          {
            name: "Total Cost",
            value: statsLoading ? null : formatCurrency(stats.totalCost),
            icon: FileText,
            gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
          },
          {
            name: "Pending Approvals",
            value: statsLoading ? null : stats.pendingApprovals,
            icon: Users,
            gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
          },
        ].map((stat) => (
          <Card
            key={stat.name}
            className={cn(
              "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] cursor-pointer p-0",
            )}
            onClick={() => {
              if (stat.name === "Active Projects") updateActiveTab("projects")
              if (stat.name === "Pending Approvals") updateActiveTab("labor")
            }}
          >
            <div className="relative p-6">
              <div className="flex items-start justify-between gap-3">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br",
                  stat.gradient
                )}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.name}</p>
                {stat.value === null ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-2 text-primary" />
                ) : (
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex min-w-full sm:min-w-0">
            <TabsTrigger value="projects" className="text-xs sm:text-sm">Projects</TabsTrigger>
            <TabsTrigger value="cost-codes" className="text-xs sm:text-sm">Cost Codes</TabsTrigger>
            <TabsTrigger value="daily-logs" className="text-xs sm:text-sm">Daily Logs</TabsTrigger>
            <TabsTrigger value="labor" className="text-xs sm:text-sm">Labor</TabsTrigger>
            <TabsTrigger value="equipment" className="text-xs sm:text-sm">Equipment</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs sm:text-sm">Inventory</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="projects">
          <ProjectsView onRefresh={fetchStats} />
        </TabsContent>

        <TabsContent value="cost-codes">
          <CostCodesView />
        </TabsContent>

        <TabsContent value="daily-logs">
          <DailyLogsView />
        </TabsContent>

        <TabsContent value="labor">
          <LaborView />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentView />
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryView />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsView />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <AddProjectDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={fetchStats} />
    </div>
  )
}
