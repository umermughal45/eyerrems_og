"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Users, UserCheck, UserX, Calendar, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { apiService } from "@/lib/api"

export function EmployeesDetailsView({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.employees || []
  })
  const [loading, setLoading] = useState(!initialData)
  const [searchQuery, setSearchQuery] = useState("")
  const [stats, setStats] = useState(() => {
    if (!initialData) return {
      totalEmployees: 0,
      activeToday: 0,
      onLeave: 0,
      avgWorkHours: 0,
    }
    const { statsData } = initialData
    return {
      totalEmployees: statsData.totalEmployees || 0,
      activeToday: statsData.activeToday || 0,
      onLeave: statsData.pendingLeaves || 0, 
      avgWorkHours: statsData.avgWorkHours || 0,
    }
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [employeesResponse, statsResponse] = await Promise.all([
        apiService.employees.getAll(),
        apiService.stats.getHRStats(),
      ])

      const employeesData = Array.isArray((employeesResponse as any)?.data?.data) 
        ? (employeesResponse as any).data.data 
        : Array.isArray((employeesResponse as any)?.data)
        ? (employeesResponse as any).data
        : []

      setEmployees(employeesData)
      
      const statsData = (statsResponse as any)?.data?.data || (statsResponse as any)?.data || {}
      setStats({
        totalEmployees: statsData.totalEmployees || 0,
        activeToday: statsData.activeToday || 0,
        onLeave: 0,
        avgWorkHours: statsData.avgWorkHours || 0,
      })
    } catch (err) {
      console.error("Failed to fetch data:", err)
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialData) {
      fetchData()
    }
  }, [fetchData, initialData])

  const departmentData = Array.isArray(employees)
    ? employees.reduce((acc: any, emp: any) => {
        if (!emp) return acc
        const dept = emp.department || "Unknown"
        if (!acc[dept]) {
          acc[dept] = 0
        }
        acc[dept]++
        return acc
      }, {})
    : {}

  const departmentChartData = Object.entries(departmentData).map(([name, count]) => ({
    name,
    count: count as number,
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
  }))

  const filteredEmployees = Array.isArray(employees)
    ? employees.filter(
        (emp) =>
          emp?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp?.position?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Total Employees Details</h1>
            <p className="text-muted-foreground mt-1">Complete overview of workforce and attendance</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 stat-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Employees</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.totalEmployees}</p>
          </Card>
          <Card className="p-6 stat-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <UserCheck className="h-5 w-5 text-success" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Active Today</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.activeToday}</p>
          </Card>
          <Card className="p-6 stat-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <UserX className="h-5 w-5 text-destructive" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">On Leave</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.onLeave}</p>
          </Card>
          <Card className="p-6 stat-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Calendar className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Avg Work Hours</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.avgWorkHours}</p>
            <p className="text-sm text-muted-foreground mt-1">per week</p>
          </Card>
        </div>

        {/* Charts */}
        {departmentChartData.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Employees by Department</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={departmentChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const { name, percent } = props;
                      return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {departmentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Department Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Department Breakdown</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Total Employees</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departmentChartData.map((dept) => (
                <TableRow key={dept.name}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="text-right font-semibold">{dept.count}</TableCell>
                  <TableCell className="text-right">
                    {stats.totalEmployees > 0
                      ? ((dept.count / stats.totalEmployees) * 100).toFixed(1)
                      : 0}
                    %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Employees List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">All Employees</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !employees.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow
                    key={emp.id}
                    onClick={() => emp.id && router.push(`/details/employees/${emp.id}`)}
                    className={emp.id ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}
                  >
                    <TableCell className="font-medium">{emp.employeeId}</TableCell>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>
                      {emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.status === "active" ? "default" : "secondary"}>
                        {emp.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
