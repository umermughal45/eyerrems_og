"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Mail, Phone, Briefcase, Loader2, Users, ArrowUpDown, FileText, Download } from "lucide-react"
import { AddEmployeeDialog } from "./add-employee-dialog"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toSimpleFilters, toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type SortField = "name" | "department" | "position" | "joinDate" | "status"
type SortDirection = "asc" | "desc"

export function EmployeesView({ onEmployeeAdded }: { onEmployeeAdded?: () => void }) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("employees", undefined) || {})
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchEmployees()
  }, [searchQuery, activeFilters])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      setError(null)
      const filters = toSimpleFilters(activeFilters)
      const params: Record<string, string | undefined> = {}
      if (searchQuery) params.search = searchQuery
      if (filters.department) params.department = filters.department as string
      if (filters.status) params.status = Array.isArray(filters.status) ? (filters.status[0] as string) : (filters.status as string)
      const response = await apiService.employees.getAll(params)
      
      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const responseData = response.data as any
      const employeesData = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
        ? responseData
        : []
      setEmployees(employeesData)
    } catch (err: any) {
      console.error('Error fetching employees:', err)
      setError(err.response?.data?.message || err.message || "Failed to fetch employees")
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  // Filtered and sorted employees (server does search, department, status; client filters employeeType)
  const filteredAndSortedEmployees = useMemo(() => {
    if (!Array.isArray(employees)) return []
    const typeFilter = activeFilters.employeeType
    const typeVal = Array.isArray(typeFilter) ? typeFilter : typeFilter ? [typeFilter] : []
    
    let filtered = employees.filter((employee) => {
      const matchesType = !typeVal.length || typeVal.includes(employee?.employeeType)
      return matchesType
    })
    
    // Sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any
      
      switch (sortField) {
        case "name":
          aValue = a.name || ""
          bValue = b.name || ""
          break
        case "department":
          aValue = a.department || ""
          bValue = b.department || ""
          break
        case "position":
          aValue = a.position || ""
          bValue = b.position || ""
          break
        case "joinDate":
          aValue = a.joinDate ? new Date(a.joinDate).getTime() : 0
          bValue = b.joinDate ? new Date(b.joinDate).getTime() : 0
          break
        case "status":
          aValue = a.status || ""
          bValue = b.status || ""
          break
        default:
          return 0
      }
      
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
    
    return filtered
  }, [employees, activeFilters.employeeType, sortField, sortDirection])
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search by TID, name, position…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        }
      />

      {/* Employees Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : filteredAndSortedEmployees.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground mb-2">
              {employees.length === 0 ? "No employees yet" : "No employees match your filters"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {employees.length === 0 
                ? "Start building your team by adding your first employee. You'll be able to manage attendance, payroll, and leave requests."
                : "Try adjusting your search or filter criteria to find employees."}
            </p>
            {employees.length === 0 && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Employee
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedEmployees.map((employee) => (
          <Card
            key={employee.id}
            className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
            onClick={() => router.push(`/details/employees/${employee.id}`)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  {employee.name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("") || "?"}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{employee.name}</h3>
                  <p className="text-sm text-muted-foreground">{employee.position}</p>
                  <p className="text-xs font-mono text-muted-foreground">{employee.trackingId || employee.tid || employee.employeeId}</p>
                </div>
              </div>
              <Badge variant={employee.status === "active" ? "default" : "secondary"}>{employee.status}</Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{employee.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                <span>{employee.department}</span>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Salary</span>
                <span className="font-semibold text-foreground">
                  Rs {employee.salary?.toLocaleString("en-PK") || "0"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Join Date</span>
                <span className="text-foreground">
                  {employee.joinDate ? new Date(employee.joinDate).toLocaleDateString() : "-"}
                </span>
              </div>
            </div>
          </Card>
          ))}
        </div>
      )}

      <AddEmployeeDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        onSuccess={() => {
          fetchEmployees()
          onEmployeeAdded?.()
        }} 
      />

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="employee"
        module="employees"
        entityDisplayName="Employees"
        filters={toExportFilters(activeFilters, "employees")}
        search={searchQuery || undefined}
        sort={sortField ? { field: sortField, direction: sortDirection } : undefined}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="employees"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("employees", undefined, filters)
          toast({ title: "Filters applied" })
        }}
      />
    </div>
  )
}
