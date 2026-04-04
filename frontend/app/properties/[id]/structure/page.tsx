"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Building2, 
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { DashboardLayout } from "@/components/dashboard-layout"

interface Floor {
  id: string
  name: string
  floorNumber: number | null
  description: string | null
  units: Unit[]
  unitCount: number
}

interface Unit {
  id: string
  unitName: string
  status: string
  monthlyRent: number | null
  description: string | null // Used for unitType
  floorId: string
}

export default function PropertyStructurePage() {
  const router = useRouter()
  const params = useParams()
  const propertyId = params?.id as string
  const { toast } = useToast()

  const [property, setProperty] = useState<any>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  
  // Floor dialog state
  const [showFloorDialog, setShowFloorDialog] = useState(false)
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null)
  const [floorForm, setFloorForm] = useState({
    name: "",
    floorNumber: "",
  })

  // Unit dialog state
  const [showUnitDialog, setShowUnitDialog] = useState(false)
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [unitForm, setUnitForm] = useState({
    unitName: "",
    unitType: "",
    status: "Vacant",
    monthlyRent: "",
  })

  useEffect(() => {
    if (propertyId) {
      fetchStructure()
    }
  }, [propertyId])

  const fetchStructure = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.properties.getStructure(propertyId)
      const data = response.data?.data || response.data
      
      if (data) {
        setProperty(data.property)
        setFloors(data.floors || [])
        // Auto-expand all floors initially
        setExpandedFloors(new Set(data.floors?.map((f: Floor) => f.id) || []))
      }
    } catch (error: any) {
      console.error("Failed to fetch structure:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to load property structure",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleFloor = (floorId: string) => {
    setExpandedFloors((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(floorId)) {
        newSet.delete(floorId)
      } else {
        newSet.add(floorId)
      }
      return newSet
    })
  }

  const openFloorDialog = (floor?: Floor) => {
    if (floor) {
      setEditingFloor(floor)
      setFloorForm({
        name: floor.name,
        floorNumber: floor.floorNumber?.toString() || "",
      })
    } else {
      setEditingFloor(null)
      setFloorForm({
        name: "",
        floorNumber: "",
      })
    }
    setShowFloorDialog(true)
  }

  const saveFloor = async () => {
    if (!floorForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Floor name is required",
        variant: "destructive",
      })
      return
    }

    try {
      if (editingFloor) {
        // Update existing floor
        await apiService.floors.update(editingFloor.id, {
          name: floorForm.name.trim(),
          floorNumber: floorForm.floorNumber ? parseInt(floorForm.floorNumber) : null,
        })
        toast({
          title: "Success",
          description: "Floor updated successfully",
        })
      } else {
        // Create new floor
        await apiService.properties.createFloor(propertyId, {
          name: floorForm.name.trim(),
          floorNumber: floorForm.floorNumber ? parseInt(floorForm.floorNumber) : null,
        })
        toast({
          title: "Success",
          description: "Floor added successfully",
        })
      }
      
      setShowFloorDialog(false)
      fetchStructure()
    } catch (error: any) {
      console.error("Failed to save floor:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to save floor",
        variant: "destructive",
      })
    }
  }

  const deleteFloor = async (floor: Floor) => {
    if (!confirm(`Are you sure you want to delete "${floor.name}"? This will also delete all units on this floor.`)) {
      return
    }

    try {
      await apiService.floors.delete(floor.id)
      toast({
        title: "Success",
        description: "Floor deleted successfully",
      })
      fetchStructure()
    } catch (error: any) {
      console.error("Failed to delete floor:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to delete floor",
        variant: "destructive",
      })
    }
  }

  const openUnitDialog = (floorId: string, unit?: Unit) => {
    setSelectedFloorId(floorId)
    if (unit) {
      setEditingUnit(unit)
      setUnitForm({
        unitName: unit.unitName,
        unitType: unit.description || "",
        status: unit.status,
        monthlyRent: unit.monthlyRent?.toString() || "",
      })
    } else {
      setEditingUnit(null)
      setUnitForm({
        unitName: "",
        unitType: "",
        status: "Vacant",
        monthlyRent: "",
      })
    }
    setShowUnitDialog(true)
  }

  const saveUnit = async () => {
    if (!unitForm.unitName.trim()) {
      toast({
        title: "Validation Error",
        description: "Unit name is required",
        variant: "destructive",
      })
      return
    }

    if (!selectedFloorId) {
      toast({
        title: "Validation Error",
        description: "Floor is required",
        variant: "destructive",
      })
      return
    }

    try {
      if (editingUnit) {
        // Update existing unit
        await apiService.units.update(editingUnit.id, {
          unitName: unitForm.unitName.trim(),
          status: unitForm.status,
          monthlyRent: unitForm.monthlyRent ? parseFloat(unitForm.monthlyRent) : null,
          description: unitForm.unitType || null,
        })
        toast({
          title: "Success",
          description: "Unit updated successfully",
        })
      } else {
        // Create new unit
        await apiService.units.createForFloor(selectedFloorId, {
          unitName: unitForm.unitName.trim(),
          unitType: unitForm.unitType,
          status: unitForm.status,
          monthlyRent: unitForm.monthlyRent ? parseFloat(unitForm.monthlyRent) : null,
        })
        toast({
          title: "Success",
          description: "Unit added successfully",
        })
      }
      
      setShowUnitDialog(false)
      fetchStructure()
    } catch (error: any) {
      console.error("Failed to save unit:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to save unit",
        variant: "destructive",
      })
    }
  }

  const deleteUnit = async (unit: Unit) => {
    if (!confirm(`Are you sure you want to delete unit "${unit.unitName}"?`)) {
      return
    }

    try {
      await apiService.units.delete(unit.id)
      toast({
        title: "Success",
        description: "Unit deleted successfully",
      })
      fetchStructure()
    } catch (error: any) {
      console.error("Failed to delete unit:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to delete unit",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/properties")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Property Structure Setup</h1>
              <p className="text-muted-foreground">
                {property?.name} {property?.propertyCode && `(${property.propertyCode})`}
              </p>
            </div>
          </div>
          <Button onClick={() => openFloorDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Floor
          </Button>
        </div>

        {/* Floors List */}
        {floors.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Floors Added Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first floor to this property
            </p>
            <Button onClick={() => openFloorDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Floor
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {floors.map((floor) => {
              const isExpanded = expandedFloors.has(floor.id)
              return (
                <Card key={floor.id} className="overflow-hidden">
                  {/* Floor Header */}
                  <div className="p-4 border-b bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFloor(floor.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <div>
                          <h3 className="font-semibold text-lg">{floor.name}</h3>
                          {floor.floorNumber !== null && (
                            <p className="text-sm text-muted-foreground">
                              Floor Number: {floor.floorNumber}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {floor.unitCount} {floor.unitCount === 1 ? "Unit" : "Units"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openFloorDialog(floor)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openUnitDialog(floor.id)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Unit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteFloor(floor)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Units List */}
                  {isExpanded && (
                    <div className="p-4">
                      {floor.units.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No units on this floor</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => openUnitDialog(floor.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Unit
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {floor.units.map((unit) => (
                            <Card key={unit.id} className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-semibold">{unit.unitName}</h4>
                                  {unit.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {unit.description}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant={
                                    unit.status === "Occupied" ? "default" : "secondary"
                                  }
                                >
                                  {unit.status}
                                </Badge>
                              </div>
                              {unit.monthlyRent && (
                                <p className="text-sm text-muted-foreground mb-3">
                                  Rent: Rs {unit.monthlyRent.toLocaleString()}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => openUnitDialog(floor.id, unit)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteUnit(unit)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Floor Dialog */}
        <Dialog open={showFloorDialog} onOpenChange={setShowFloorDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingFloor ? "Edit Floor" : "Add New Floor"}
              </DialogTitle>
              <DialogDescription>
                {editingFloor
                  ? "Update floor information"
                  : "Add a new floor to this property"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="floorName">Floor Name *</Label>
                <Input
                  id="floorName"
                  placeholder="e.g., Ground Floor, 1st Floor, Basement"
                  value={floorForm.name}
                  onChange={(e) =>
                    setFloorForm({ ...floorForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floorNumber">Floor Number (Optional)</Label>
                <Input
                  id="floorNumber"
                  type="number"
                  placeholder="e.g., 0, 1, 2, -1 for basement"
                  value={floorForm.floorNumber}
                  onChange={(e) =>
                    setFloorForm({ ...floorForm, floorNumber: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use this to order floors. Lower numbers appear first.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFloorDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveFloor}>Save Floor</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unit Dialog */}
        <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUnit ? "Edit Unit" : "Add New Unit"}
              </DialogTitle>
              <DialogDescription>
                {editingUnit
                  ? "Update unit information"
                  : "Add a new unit to this floor"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="unitName">Unit Name/Number *</Label>
                <Input
                  id="unitName"
                  placeholder="e.g., 101, A-1, Shop-1"
                  value={unitForm.unitName}
                  onChange={(e) =>
                    setUnitForm({ ...unitForm, unitName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitType">Unit Type</Label>
                <Select
                  value={unitForm.unitType}
                  onValueChange={(value) =>
                    setUnitForm({ ...unitForm, unitType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Studio">Studio</SelectItem>
                    <SelectItem value="1BHK">1BHK</SelectItem>
                    <SelectItem value="2BHK">2BHK</SelectItem>
                    <SelectItem value="3BHK">3BHK</SelectItem>
                    <SelectItem value="4BHK">4BHK</SelectItem>
                    <SelectItem value="Shop">Shop</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Warehouse">Warehouse</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={unitForm.status}
                  onValueChange={(value) =>
                    setUnitForm({ ...unitForm, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vacant">Vacant</SelectItem>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">Monthly Rent (Optional)</Label>
                <Input
                  id="monthlyRent"
                  type="number"
                  placeholder="e.g., 50000"
                  value={unitForm.monthlyRent}
                  onChange={(e) =>
                    setUnitForm({ ...unitForm, monthlyRent: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnitDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveUnit}>Save Unit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

