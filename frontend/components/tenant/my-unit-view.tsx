"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Home, MapPin, Calendar, DollarSign, User, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"

export function MyUnitView({ tenantData, leaseData }: { tenantData: any; leaseData: any }) {
  const [loading, setLoading] = useState(true)
  const [unitData, setUnitData] = useState<any>(null)
  const [propertyData, setPropertyData] = useState<any>(null)

  useEffect(() => {
    fetchUnitData()
  }, [tenantData, leaseData])

  const fetchUnitData = async () => {
    try {
      if (!tenantData?.unitId) {
        setLoading(false)
        return
      }

      // Get unit details
      const unitsRes = await apiService.units.getAll()
      const units = Array.isArray((unitsRes as any)?.data?.data)
        ? (unitsRes as any).data.data
        : Array.isArray((unitsRes as any)?.data)
          ? (unitsRes as any).data
          : []
      
      const unit = units.find((u: any) => u.id === tenantData.unitId)
      setUnitData(unit)

      if (unit?.propertyId) {
        // Get property details
        const propertiesRes = await apiService.properties.getAll()
        const properties = Array.isArray((propertiesRes as any)?.data?.data)
          ? (propertiesRes as any).data.data
          : Array.isArray((propertiesRes as any)?.data)
            ? (propertiesRes as any).data
            : []
        
        const property = properties.find((p: any) => p.id === unit.propertyId)
        setPropertyData(property)
      }
    } catch (error) {
      console.error("Error fetching unit data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!unitData || !tenantData) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No unit information available.</p>
      </Card>
    )
  }

  const unitInfo = {
    unitNumber: unitData.unitName || "N/A",
    property: propertyData?.name || "N/A",
    address: propertyData?.address || "N/A",
    type: unitData.description || "N/A",
    size: unitData.size || "N/A",
    rent: leaseData ? `Rs ${(leaseData.rent || 0).toLocaleString("en-PK")}` : "N/A",
    leaseStart: leaseData?.leaseStart ? new Date(leaseData.leaseStart).toISOString().split('T')[0] : "N/A",
    leaseEnd: leaseData?.leaseEnd ? new Date(leaseData.leaseEnd).toISOString().split('T')[0] : "N/A",
    propertyManager: "Property Management",
    managerEmail: "management@realestate.com",
    managerPhone: "+1 234-567-8900",
  }

  return (
    <div className="space-y-6">
      {/* Unit Details Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Unit {unitInfo.unitNumber}</h2>
            <p className="text-lg text-muted-foreground mt-1">{unitInfo.property}</p>
          </div>
          <Badge variant="default">Active Lease</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Property Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Property Information</h3>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Address</p>
                <p className="text-sm text-muted-foreground mt-1">{unitInfo.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Unit Type</p>
                <p className="text-sm text-muted-foreground mt-1">{unitInfo.type}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Size</p>
                <p className="text-sm text-muted-foreground mt-1">{unitInfo.size}</p>
              </div>
            </div>
          </div>

          {/* Lease Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Lease Information</h3>

            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Monthly Rent</p>
                <p className="text-sm text-muted-foreground mt-1">{unitInfo.rent}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Lease Period</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(unitInfo.leaseStart).toLocaleDateString()} -{" "}
                  {new Date(unitInfo.leaseEnd).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Property Manager</p>
                <p className="text-sm text-muted-foreground mt-1">{unitInfo.propertyManager}</p>
                <p className="text-sm text-muted-foreground">{unitInfo.managerEmail}</p>
                <p className="text-sm text-muted-foreground">{unitInfo.managerPhone}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Amenities */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Amenities</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Swimming Pool", "Gym", "Parking", "24/7 Security", "Elevator", "Laundry", "Pet Friendly", "WiFi"].map(
            (amenity) => (
              <div key={amenity} className="flex items-center gap-2 text-sm text-foreground">
                <div className="h-2 w-2 rounded-full bg-primary" />
                {amenity}
              </div>
            ),
          )}
        </div>
      </Card>
    </div>
  )
}
