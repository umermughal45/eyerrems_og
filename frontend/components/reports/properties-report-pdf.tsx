"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, FileText, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"

type Property = {
  id: string
  name: string | null
  propertyCode: string | null
  type: string | null
  address: string | null
  salePrice: number | null
  subsidiaryOption?: {
    id: string
    name: string
    propertySubsidiary?: {
      id: string
      name: string
      logoPath: string | null
    } | null
  } | null
}

export function PropertiesReportPDF() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set())

  const loadProperties = async () => {
    setLoading(true)
    try {
      const response = await apiService.properties.getAll()
      const props = (response.data as any)?.data || response.data || []
      setProperties(Array.isArray(props) ? props : [])
    } catch (error: any) {
      toast({
        title: "Failed to load properties",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleProperty = (propertyId: string) => {
    const newSelected = new Set(selectedProperties)
    if (newSelected.has(propertyId)) {
      newSelected.delete(propertyId)
    } else {
      newSelected.add(propertyId)
    }
    setSelectedProperties(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedProperties.size === properties.length) {
      setSelectedProperties(new Set())
    } else {
      setSelectedProperties(new Set(properties.map(p => p.id)))
    }
  }

  const handleGenerateReport = async () => {
    if (selectedProperties.size === 0) {
      toast({
        title: "No properties selected",
        description: "Please select at least one property to generate the report",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const propertyIds = Array.from(selectedProperties)
      const queryParams = new URLSearchParams()
      propertyIds.forEach(id => queryParams.append('propertyIds', id))

      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const url = `${apiUrl}/properties/report/pdf?${queryParams.toString()}`

      // Open in new window to download PDF
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `properties-report-${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Report generated",
        description: "PDF report with subsidiary logo watermarks is being downloaded",
      })
    } catch (error: any) {
      toast({
        title: "Failed to generate report",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Properties Report Generator</h2>
          <p className="text-sm text-muted-foreground">
            Generate PDF reports with subsidiary logo watermarks
          </p>
        </div>
        <Button onClick={loadProperties} disabled={loading} variant="outline">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Load Properties
            </>
          )}
        </Button>
      </div>

      {properties.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <Label>Select Properties ({selectedProperties.size} selected)</Label>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedProperties.size === properties.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
            {properties.map((property) => (
              <div
                key={property.id}
                className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md"
              >
                <Checkbox
                  checked={selectedProperties.has(property.id)}
                  onCheckedChange={() => handleToggleProperty(property.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{property.name || "Unnamed Property"}</div>
                  <div className="text-sm text-muted-foreground">
                    {property.propertyCode && `Code: ${property.propertyCode} • `}
                    {property.type && `Type: ${property.type} • `}
                    {property.subsidiaryOption && `Subsidiary: ${property.subsidiaryOption.name}`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={handleGenerateReport}
            disabled={loading || selectedProperties.size === 0}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate PDF Report ({selectedProperties.size} properties)
              </>
            )}
          </Button>
        </>
      )}

      {properties.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No properties loaded. Click "Load Properties" to get started.</p>
        </div>
      )}
    </Card>
  )
}

