"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2,
  Search,
  FileText,
  TrendingUp,
  DollarSign,
  Calendar,
  Download,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"

interface ProjectCostSummary {
  projectId: string
  costCodeSummary: Array<{
    costCode: {
      id: string
      code: string
      name: string
    }
    debit: number
    credit: number
  }>
  totalDebit: number
  totalCredit: number
  netCost: number
}

interface BudgetVsActual {
  costCode: {
    id: string
    code: string
    name: string
  }
  budgetAmount: number
  actualAmount: number
  variance: number
  variancePercentage: number
}

export function ReportsView() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("cost-summary")
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [costSummary, setCostSummary] = useState<ProjectCostSummary | null>(null)
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActual[]>([])
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  useEffect(() => {
    fetchProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProjects = async () => {
    try {
      const response = await apiService.construction.projects.getAll({ limit: 100 })
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setProjects(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  const fetchCostSummary = async () => {
    if (!selectedProject) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const response = await apiService.construction.reports.projectCostSummary(selectedProject)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setCostSummary(responseData.data || responseData)
      }
    } catch (error) {
      console.error("Error fetching cost summary:", error)
      toast({
        title: "Error",
        description: "Failed to fetch cost summary",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgetVsActual = async () => {
    if (!selectedProject) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const response = await apiService.construction.reports.budgetVsActual(selectedProject)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setBudgetVsActual(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching budget vs actual:", error)
      toast({
        title: "Error",
        description: "Failed to fetch budget vs actual",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "cost-summary" && selectedProject) {
      fetchCostSummary()
    } else if (activeTab === "budget-vs-actual" && selectedProject) {
      fetchBudgetVsActual()
    }
  }, [activeTab, selectedProject]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label>Select Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cost-summary">Project Cost Summary</TabsTrigger>
          <TabsTrigger value="budget-vs-actual">Budget vs Actual</TabsTrigger>
        </TabsList>

        {/* Cost Summary Tab */}
        <TabsContent value="cost-summary" className="space-y-4">
          <Card>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Project Cost Summary</h3>
                {selectedProject && (
                  <Button variant="outline" size="sm" onClick={fetchCostSummary}>
                    <Download className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </div>
            </div>
            {!selectedProject ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Please select a project to view cost summary</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : costSummary ? (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Debit</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(costSummary.totalDebit)}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Credit</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(costSummary.totalCredit)}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Net Cost</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(costSummary.netCost)}
                    </div>
                  </Card>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costSummary.costCodeSummary.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {item.costCode?.code || "NO_COST_CODE"}
                        </TableCell>
                        <TableCell>{item.costCode?.name || "No Cost Code"}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(item.debit)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(item.credit)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.debit - item.credit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No cost data available</p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Budget vs Actual Tab */}
        <TabsContent value="budget-vs-actual" className="space-y-4">
          <Card>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Budget vs Actual</h3>
                {selectedProject && (
                  <Button variant="outline" size="sm" onClick={fetchBudgetVsActual}>
                    <Download className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </div>
            </div>
            {!selectedProject ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Please select a project to view budget vs actual</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : budgetVsActual.length > 0 ? (
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-right">Variance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetVsActual.map((item, index) => {
                      const isOverBudget = item.variance < 0
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">
                            {item.costCode?.code || "-"}
                          </TableCell>
                          <TableCell>{item.costCode?.name || "-"}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.budgetAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.actualAmount)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${isOverBudget ? "text-red-600" : "text-green-600"}`}>
                            {formatCurrency(item.variance)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={isOverBudget ? "destructive" : "default"}>
                              {item.variancePercentage.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No budget data available</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
