"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Building2, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface UnitInput {
  id: string
  name: string
}

interface FloorInput {
  id: string
  name: string
  floorNumber: string
  unitCount: string
  units: UnitInput[]
  useCustomNames: boolean
  expanded: boolean
}

interface PropertyStructureSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  propertyName: string
  onComplete?: () => void
}

export function PropertyStructureSetupDialog({
  open,
  onOpenChange,
  propertyId,
  propertyName,
  onComplete,
}: PropertyStructureSetupDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [floors, setFloors] = useState<FloorInput[]>([
    { id: "1", name: "Ground Floor", floorNumber: "0", unitCount: "", units: [], useCustomNames: false, expanded: false },
  ])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && propertyId) {
      fetchExistingStructure()
    } else if (open) {
      // Reset to default when dialog opens for new property
      setFloors([{ id: "1", name: "Ground Floor", floorNumber: "0", unitCount: "", units: [], useCustomNames: false, expanded: false }])
    }
  }, [open, propertyId])

  const fetchExistingStructure = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.properties.getStructure(propertyId)
      const responseData = response.data as any
      const structureData = responseData?.data || responseData
      
      if (structureData?.floors && Array.isArray(structureData.floors) && structureData.floors.length > 0) {
        // Load existing floors and units
        const loadedFloors: FloorInput[] = structureData.floors.map((floor: any) => {
          const existingUnits = floor.units || []
          const hasUnits = existingUnits.length > 0
          
          return {
            id: floor.id,
            name: floor.name || `Floor ${floor.floorNumber || 0}`,
            floorNumber: floor.floorNumber?.toString() || "0",
            unitCount: hasUnits ? existingUnits.length.toString() : "",
            units: existingUnits.map((unit: any) => ({
              id: unit.id,
              name: unit.unitName || unit.name || "",
            })),
            useCustomNames: hasUnits,
            expanded: false,
          }
        })
        
        setFloors(loadedFloors)
      } else {
        // No existing structure, start with default
        setFloors([{ id: "1", name: "Ground Floor", floorNumber: "0", unitCount: "", units: [], useCustomNames: false, expanded: false }])
      }
    } catch (err: any) {
      console.error("Failed to fetch existing structure:", err)
      // On error, start with default
      setFloors([{ id: "1", name: "Ground Floor", floorNumber: "0", unitCount: "", units: [], useCustomNames: false, expanded: false }])
    } finally {
      setLoading(false)
    }
  }

  const addFloor = () => {
    const newFloorNumber = floors.length
    setFloors([
      ...floors,
      {
        id: Date.now().toString(),
        name: `Floor ${newFloorNumber}`,
        floorNumber: newFloorNumber.toString(),
        unitCount: "",
        units: [],
        useCustomNames: false,
        expanded: false,
      },
    ])
  }

  const removeFloor = (id: string) => {
    if (floors.length === 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one floor is required",
        variant: "destructive",
      })
      return
    }
    setFloors(floors.filter((f) => f.id !== id))
  }

  const updateFloor = (id: string, field: keyof FloorInput, value: any) => {
    setFloors(
      floors.map((floor) => {
        if (floor.id === id) {
          if (field === "useCustomNames" && value === true) {
            // When switching to custom names, initialize units based on count
            const count = parseInt(floor.unitCount) || 0
            const floorNumber = parseInt(floor.floorNumber) || 0
            const baseUnitNumber = floorNumber * 100 || 0
            const newUnits: UnitInput[] = []
            
            for (let i = 1; i <= count; i++) {
              const unitNumber = baseUnitNumber > 0 ? baseUnitNumber + i : String(i).padStart(3, "0")
              newUnits.push({
                id: Date.now().toString() + i,
                name: unitNumber.toString(),
              })
            }
            
            return { ...floor, [field]: value, units: newUnits }
          }
          return { ...floor, [field]: value }
        }
        return floor
      })
    )
  }

  const toggleFloorExpanded = (id: string) => {
    updateFloor(id, "expanded", !floors.find(f => f.id === id)?.expanded)
  }

  const addUnitToFloor = (floorId: string) => {
    setFloors(
      floors.map((floor) => {
        if (floor.id === floorId) {
          return {
            ...floor,
            units: [
              ...floor.units,
              { id: Date.now().toString(), name: "" },
            ],
          }
        }
        return floor
      })
    )
  }

  const removeUnitFromFloor = (floorId: string, unitId: string) => {
    setFloors(
      floors.map((floor) => {
        if (floor.id === floorId) {
          return {
            ...floor,
            units: floor.units.filter((u) => u.id !== unitId),
          }
        }
        return floor
      })
    )
  }

  const updateUnitName = (floorId: string, unitId: string, name: string) => {
    setFloors(
      floors.map((floor) => {
        if (floor.id === floorId) {
          return {
            ...floor,
            units: floor.units.map((u) =>
              u.id === unitId ? { ...u, name } : u
            ),
          }
        }
        return floor
      })
    )
  }

  const handleSkip = () => {
    onOpenChange(false)
    if (onComplete) {
      onComplete()
    } else {
      router.push("/properties")
    }
  }

  const handleSave = async () => {
    // Validate
    const hasEmptyNames = floors.some((f) => !f.name.trim())
    if (hasEmptyNames) {
      toast({
        title: "Validation Error",
        description: "All floors must have a name",
        variant: "destructive",
      })
      return
    }

    // Validate custom unit names
    for (const floor of floors) {
      if (floor.useCustomNames) {
        const hasEmptyUnitNames = floor.units.some((u) => !u.name.trim())
        if (hasEmptyUnitNames) {
          toast({
            title: "Validation Error",
            description: `All units on "${floor.name}" must have a name`,
            variant: "destructive",
          })
          return
        }
      } else {
        const hasInvalidUnitCounts = floor.unitCount && (isNaN(Number(floor.unitCount)) || Number(floor.unitCount) < 0)
        if (hasInvalidUnitCounts) {
          toast({
            title: "Validation Error",
            description: "Unit count must be a valid number",
            variant: "destructive",
          })
          return
        }
      }
    }

    try {
      setSaving(true)

      // Fetch existing structure to determine what to update vs create
      let existingStructure: any = null
      try {
        const structureResponse: any = await apiService.properties.getStructure(propertyId)
        existingStructure = structureResponse?.data?.data || structureResponse?.data
      } catch (fetchErr) {
        console.error("Failed to fetch existing structure:", fetchErr)
      }

      const existingFloors = existingStructure?.floors || []
      const processedFloors: { id: string; floorInput: FloorInput }[] = []
      let totalUnitsUpdated = 0
      let totalUnitsCreated = 0

      // Process each floor (update existing or create new)
      for (const floor of floors) {
        try {
          const existingFloor = existingFloors.find((ef: any) => ef.id === floor.id)
          
          if (existingFloor) {
            // Update existing floor
            await apiService.floors.update(floor.id, {
              name: floor.name.trim(),
              floorNumber: floor.floorNumber ? parseInt(floor.floorNumber) : null,
            })
            processedFloors.push({ id: floor.id, floorInput: floor })
          } else {
            // Create new floor
            const response: any = await apiService.properties.createFloor(propertyId, {
              name: floor.name.trim(),
              floorNumber: floor.floorNumber ? parseInt(floor.floorNumber) : null,
            })
            const createdFloor = response?.data?.data || response?.data
            if (createdFloor?.id) {
              processedFloors.push({ id: createdFloor.id, floorInput: floor })
            }
          }
        } catch (error: any) {
          console.error(`Failed to save floor ${floor.name}:`, error)
          toast({
            title: "Partial Error",
            description: `Failed to save floor "${floor.name}". Continuing with others...`,
            variant: "destructive",
          })
        }
      }

      // Process units for each floor
      for (const { id: floorId, floorInput } of processedFloors) {
        const existingFloor = existingFloors.find((ef: any) => ef.id === floorId)
        const existingUnits = existingFloor?.units || []
        
        if (floorInput.useCustomNames) {
          // Handle custom named units
          for (const unit of floorInput.units) {
            if (unit.name.trim()) {
              try {
                const existingUnit = existingUnits.find((eu: any) => eu.id === unit.id)
                if (existingUnit) {
                  // Update existing unit
                  await apiService.units.update(unit.id, {
                    unitName: unit.name.trim(),
                  })
                  totalUnitsUpdated++
                } else {
                  // Create new unit
                  await apiService.units.createForFloor(floorId, {
                    unitName: unit.name.trim(),
                    status: "Vacant",
                  })
                  totalUnitsCreated++
                }
              } catch (error: any) {
                console.error(`Failed to save unit ${unit.name}:`, error)
              }
            }
          }
          
          // Delete units that were removed
          const currentUnitIds = floorInput.units.map(u => u.id).filter(Boolean)
          for (const existingUnit of existingUnits) {
            if (!currentUnitIds.includes(existingUnit.id)) {
              try {
                await apiService.units.delete(existingUnit.id)
              } catch (error: any) {
                console.error(`Failed to delete unit ${existingUnit.unitName}:`, error)
              }
            }
          }
        } else {
          // Handle count-based units
          const unitCount = floorInput.unitCount ? parseInt(floorInput.unitCount) : 0
          const floorNumber = floorInput.floorNumber ? parseInt(floorInput.floorNumber) : 0
          const baseUnitNumber = floorNumber * 100 || 0

          if (unitCount > 0) {
            for (let i = 1; i <= unitCount; i++) {
              try {
                const unitNumber = baseUnitNumber > 0 ? baseUnitNumber + i : String(i).padStart(3, "0")
                const unitName = unitNumber.toString()
                
                // Check if unit with this name already exists
                const existingUnit = existingUnits.find((eu: any) => eu.unitName === unitName)
                
                if (!existingUnit) {
                  // Create new unit
                  await apiService.units.createForFloor(floorId, {
                    unitName: unitName,
                    status: "Vacant",
                  })
                  totalUnitsCreated++
                }
              } catch (error: any) {
                console.error(`Failed to create unit ${i} for floor ${floorInput.name}:`, error)
              }
            }
          }
        }
      }

      toast({
        title: "Success",
        description: `Updated ${processedFloors.length} floor(s) with ${totalUnitsCreated} new unit(s) and ${totalUnitsUpdated} updated unit(s)`,
      })

      onOpenChange(false)
      if (onComplete) {
        onComplete()
      } else {
        // Refresh the page or property details
        window.location.reload()
      }
    } catch (error: any) {
      console.error("Failed to save structure:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to save structure",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const totalUnits = floors.reduce((sum, floor) => {
    if (floor.useCustomNames) {
      return sum + floor.units.length
    }
    return sum + (floor.unitCount ? parseInt(floor.unitCount) || 0 : 0)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[800px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property Structure</DialogTitle>
          <DialogDescription>
            Edit floors and units for <strong>{propertyName}</strong>. Existing structure will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Add floors and specify unit names or counts for each floor
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addFloor}>
              <Plus className="h-4 w-4 mr-2" />
              Add Floor
            </Button>
          </div>

          <div className="space-y-3">
            {floors.map((floor) => (
              <Card key={floor.id} className="p-4">
                <div className="space-y-4">
                  {/* Floor Header */}
                  <div className="flex items-start gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFloorExpanded(floor.id)}
                      className="mt-1"
                    >
                      {floor.expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`floor-name-${floor.id}`}>
                          Floor Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`floor-name-${floor.id}`}
                          placeholder="e.g., Ground Floor, 1st Floor"
                          value={floor.name}
                          onChange={(e) => updateFloor(floor.id, "name", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`floor-number-${floor.id}`}>Floor Number</Label>
                        <Input
                          id={`floor-number-${floor.id}`}
                          type="number"
                          placeholder="0, 1, 2..."
                          value={floor.floorNumber}
                          onChange={(e) =>
                            updateFloor(floor.id, "floorNumber", e.target.value)
                          }
                        />
                        <p className="text-xs text-muted-foreground">For ordering (optional)</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Unit Input Mode</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={!floor.useCustomNames ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateFloor(floor.id, "useCustomNames", false)}
                          >
                            Count
                          </Button>
                          <Button
                            type="button"
                            variant={floor.useCustomNames ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateFloor(floor.id, "useCustomNames", true)}
                          >
                            Custom Names
                          </Button>
                        </div>
                      </div>
                    </div>

                    {floors.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFloor(floor.id)}
                        className="mt-1"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  {/* Units Section - Expandable */}
                  {floor.expanded && (
                    <div className="pl-10 space-y-3 border-t pt-4">
                      {!floor.useCustomNames ? (
                        // Count Mode
                        <div className="space-y-2">
                          <Label htmlFor={`unit-count-${floor.id}`}>Number of Units</Label>
                          <Input
                            id={`unit-count-${floor.id}`}
                            type="number"
                            placeholder="e.g., 5"
                            min="0"
                            value={floor.unitCount}
                            onChange={(e) => updateFloor(floor.id, "unitCount", e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Units will be auto-named (e.g., 101, 102, 103...)
                          </p>
                          {floor.unitCount && parseInt(floor.unitCount) > 0 && (
                            <Badge variant="secondary" className="mt-2">
                              {floor.unitCount} unit(s) will be created
                            </Badge>
                          )}
                        </div>
                      ) : (
                        // Custom Names Mode
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Unit Names</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addUnitToFloor(floor.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Unit
                            </Button>
                          </div>
                          
                          {floor.units.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No units added. Click "Add Unit" to add custom unit names.
                            </p>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                              {floor.units.map((unit) => (
                                <div key={unit.id} className="flex items-center gap-2">
                                  <Input
                                    placeholder="e.g., 101, A-1, Shop-1"
                                    value={unit.name}
                                    onChange={(e) =>
                                      updateUnitName(floor.id, unit.id, e.target.value)
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeUnitFromFloor(floor.id, unit.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Summary</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Floors</p>
                <p className="font-semibold text-lg">{floors.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Units</p>
                <p className="font-semibold text-lg">{totalUnits}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Floors with Units</p>
                <p className="font-semibold text-lg">
                  {floors.filter((f) => {
                    if (f.useCustomNames) return f.units.length > 0
                    return f.unitCount && parseInt(f.unitCount) > 0
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleSkip} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Structure"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
