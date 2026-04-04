"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, TrendingUp, Mail, Building2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

const clientTypeData = [
  { name: "Individual", value: 45, color: "#2563eb" },
  { name: "Corporate", value: 28, color: "#10b981" },
]

const topClients = [
  { id: 1, name: "ABC Corporation", type: "Corporate", properties: 5, revenue: 125000, contact: "john@abc.com" },
  { id: 2, name: "John Smith", type: "Individual", properties: 3, revenue: 85000, contact: "john.smith@email.com" },
  {
    id: 3,
    name: "Tech Innovations Ltd",
    type: "Corporate",
    properties: 4,
    revenue: 98000,
    contact: "info@techinno.com",
  },
  { id: 4, name: "Sarah Johnson", type: "Individual", properties: 2, revenue: 65000, contact: "sarah.j@email.com" },
  { id: 5, name: "Global Ventures", type: "Corporate", properties: 6, revenue: 145000, contact: "contact@global.com" },
]

export default function ActiveClientsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Active Clients</h1>
            <p className="text-muted-foreground mt-1">Complete overview of all active clients</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Active Clients</p>
            <p className="text-3xl font-bold text-foreground mt-2">73</p>
            <div className="flex items-center gap-1 mt-2 text-success">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">+12% this month</span>
            </div>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Individual Clients</p>
            <p className="text-3xl font-bold text-foreground mt-2">45</p>
            <p className="text-sm text-muted-foreground mt-2">61.6% of total</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Corporate Clients</p>
            <p className="text-3xl font-bold text-foreground mt-2">28</p>
            <p className="text-sm text-muted-foreground mt-2">38.4% of total</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-bold text-foreground mt-2">$518K</p>
            <p className="text-sm text-muted-foreground mt-2">From active clients</p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Client Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clientTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={(props: any) => {
                    const { name, percent } = props;
                    return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
                  }}
                >
                  {clientTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Clients by Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topClients.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">All Active Clients</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    <Badge variant={client.type === "Corporate" ? "default" : "secondary"}>{client.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{client.properties}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{client.contact}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">${client.revenue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
