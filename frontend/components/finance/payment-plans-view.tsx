"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Download, FileText, Plus, Search, Filter, Loader2, Eye, Edit } from "lucide-react"
import { format } from "date-fns"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function PaymentPlansView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [reports, setReports] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("plans")
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [reportStartDate, setReportStartDate] = useState<Date>()
  const [reportEndDate, setReportEndDate] = useState<Date>()

  useEffect(() => {
    loadPaymentPlans()
  }, [statusFilter])

  const loadPaymentPlans = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (statusFilter !== "all") {
        // You can add status filtering logic here
      }
      
      const response: any = await apiService.paymentPlans.getAll(filters)
      const responseData = response?.data || response
      if (responseData?.success) {
        setPlans(responseData.data || [])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load payment plans",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadReports = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (reportStartDate) filters.startDate = format(reportStartDate, "yyyy-MM-dd")
      if (reportEndDate) filters.endDate = format(reportEndDate, "yyyy-MM-dd")
      
      const response: any = await apiService.paymentPlans.getReports(filters)
      if (response.data?.success) {
        setReports(response.data.data)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load reports",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportReceipts = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (reportStartDate) filters.startDate = format(reportStartDate, "yyyy-MM-dd")
      if (reportEndDate) filters.endDate = format(reportEndDate, "yyyy-MM-dd")
      
      const response: any = await apiService.receipts.export(filters)
      
      // Create blob and download
      const blob = new Blob([response.data], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `receipts-export-${format(new Date(), "yyyy-MM-dd")}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Receipts exported successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export receipts",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewPlan = (plan: any) => {
    setSelectedPlan(plan)
    setViewDialogOpen(true)
  }

  const filteredPlans = plans.filter((plan) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        plan.deal?.dealCode?.toLowerCase().includes(searchLower) ||
        plan.deal?.title?.toLowerCase().includes(searchLower) ||
        plan.client?.name?.toLowerCase().includes(searchLower) ||
        plan.client?.clientCode?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: "default",
      unpaid: "secondary",
      overdue: "destructive",
      partial: "outline",
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Plans</h1>
          <p className="text-muted-foreground">Manage payment plans and track installments</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Payment Plans</TabsTrigger>
          <TabsTrigger value="reports" onClick={loadReports}>Installment Reports</TabsTrigger>
          <TabsTrigger value="receipts">Receipts Export</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Payment Plans</CardTitle>
                  <CardDescription>View and manage all payment plans</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredPlans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payment plans found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal Code</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Installments</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">
                          {plan.deal?.dealCode || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plan.client?.name || "N/A"}</div>
                            <div className="text-sm text-muted-foreground">
                              {plan.client?.clientCode || ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          Rs {plan.summary?.totalAmount?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </TableCell>
                        <TableCell>
                          {plan.summary?.paidInstallments || 0} / {plan.summary?.totalInstallments || 0}
                        </TableCell>
                        <TableCell>
                          Rs {plan.summary?.paidAmount?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </TableCell>
                        <TableCell>
                          Rs {plan.summary?.remainingAmount?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </TableCell>
                        <TableCell>
                          {plan.summary?.remainingAmount === 0 ? (
                            <Badge variant="default">Completed</Badge>
                          ) : plan.summary?.overdueInstallments > 0 ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="secondary">In Progress</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPlan(plan)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Installment Reports</CardTitle>
                  <CardDescription>View detailed installment reports</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-64 justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportStartDate ? format(reportStartDate, "PPP") : "Start Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={reportStartDate}
                        onSelect={setReportStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-64 justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportEndDate ? format(reportEndDate, "PPP") : "End Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={reportEndDate}
                        onSelect={setReportEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button onClick={loadReports} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : reports ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Total Installments</CardDescription>
                        <CardTitle className="text-2xl">{reports.summary?.total || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Paid</CardDescription>
                        <CardTitle className="text-2xl text-green-600">{reports.summary?.paid || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Unpaid</CardDescription>
                        <CardTitle className="text-2xl text-yellow-600">{reports.summary?.unpaid || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Overdue</CardDescription>
                        <CardTitle className="text-2xl text-red-600">{reports.summary?.overdue || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Installment #</TableHead>
                        <TableHead>Deal Code</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Paid Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.installments?.map((inst: any) => (
                        <TableRow key={inst.id}>
                          <TableCell>{inst.installmentNumber}</TableCell>
                          <TableCell>{inst.paymentPlan?.deal?.dealCode || "N/A"}</TableCell>
                          <TableCell>{inst.paymentPlan?.client?.name || "N/A"}</TableCell>
                          <TableCell>
                            Rs {inst.amount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>{format(new Date(inst.dueDate), "PPP")}</TableCell>
                          <TableCell>
                            Rs {inst.paidAmount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>{getStatusBadge(inst.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select date range and click filter to load reports
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Receipts</CardTitle>
              <CardDescription>Export payment receipts in CSV format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportStartDate ? format(reportStartDate, "PPP") : "Select start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={reportStartDate}
                        onSelect={setReportStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportEndDate ? format(reportEndDate, "PPP") : "Select end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={reportEndDate}
                        onSelect={setReportEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button onClick={handleExportReceipts} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Receipts (CSV)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Plan Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-[90vw] md:max-w-4xl max-w-[95vw] sm:max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Plan Details</DialogTitle>
            <DialogDescription>
              {selectedPlan?.deal?.dealCode} - {selectedPlan?.client?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Amount</Label>
                  <p className="text-lg font-semibold">
                    Rs {selectedPlan.summary?.totalAmount?.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
                <div>
                  <Label>Remaining Amount</Label>
                  <p className="text-lg font-semibold">
                    Rs {selectedPlan.summary?.remainingAmount?.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
              </div>

              <div>
                <Label>Installments</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Paid Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPlan.installments?.map((inst: any) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installmentNumber}</TableCell>
                        <TableCell>
                          Rs {inst.amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>{format(new Date(inst.dueDate), "PPP")}</TableCell>
                        <TableCell>
                          Rs {inst.paidAmount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>{getStatusBadge(inst.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

