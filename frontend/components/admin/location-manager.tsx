"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, PlusCircle, Edit3, Trash2, RefreshCw, MapPin } from "lucide-react"
import { useDropdownOptions } from "@/hooks/use-dropdowns"
import { useLocationTree } from "@/hooks/use-location-tree"
import { LOCATION_LEVELS } from "@/lib/location"

type LocationForm = {
  label: string
  value: string
  sortOrder: number
}

export function LocationManager() {
  const { toast } = useToast()
  const { options, isLoading: loadingOptions, mutate: refreshOptions } = useDropdownOptions("property.location")
  const { tree: locationTree, refresh: refreshLocationTree } = useLocationTree()
  const [newLocation, setNewLocation] = useState<LocationForm>({ label: "", value: "", sortOrder: 0 })
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [editingPayload, setEditingPayload] = useState<LocationForm>({ label: "", value: "", sortOrder: 0 })
  const [busy, setBusy] = useState(false)

  const sortedLocations = options.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  // Helper function to find or create location in tree
  const findOrCreateLocation = async (name: string, type: string, parentId: string | null = null): Promise<string> => {
    // First, try to find existing location by searching the tree
    const findInTree = (nodes: any[], targetName: string, targetType: string, targetParentId: string | null): string | null => {
      for (const node of nodes) {
        const nodeParentId = node.parentId || null
        if (node.name.toLowerCase() === targetName.toLowerCase() && 
            node.type.toLowerCase() === targetType.toLowerCase() && 
            nodeParentId === targetParentId) {
          return node.id
        }
        if (node.children && node.children.length > 0) {
          const found = findInTree(node.children, targetName, targetType, targetParentId)
          if (found) return found
        }
      }
      return null
    }

    // Check in current tree first
    const existingId = findInTree(locationTree || [], name, type, parentId)
    if (existingId) {
      return existingId
    }

    // Try to create new location (API will handle uniqueness constraints)
    try {
      const response = await apiService.locations.create({
        name: name.trim(),
        type: type,
        parentId: parentId,
      })
      const responseData = response.data as any
      const created = responseData?.data ?? responseData
      // Refresh tree after creation
      await refreshLocationTree()
      return created.id
    } catch (error: any) {
      // If location already exists (unique constraint), refresh tree and find it
      if (error?.response?.status === 409 || error?.response?.status === 400 || 
          error?.response?.data?.message?.toLowerCase().includes('unique') ||
          error?.response?.data?.message?.toLowerCase().includes('already exists')) {
        await refreshLocationTree()
        // Wait a moment for SWR to update
        await new Promise(resolve => setTimeout(resolve, 200))
        // Get the tree again - we need to trigger a re-render, so we'll search via API
        // For now, just try searching by getting children of parent or searching
        try {
          if (parentId) {
            const childrenRes = await apiService.locations.getChildren(parentId)
            const childrenData = (childrenRes.data as any)?.data ?? childrenRes.data ?? []
            const found = Array.isArray(childrenData) 
              ? childrenData.find((loc: any) => 
                  loc.name.toLowerCase() === name.toLowerCase() && 
                  loc.type.toLowerCase() === type.toLowerCase()
                )
              : null
            if (found) return found.id
          } else {
            // Search root level - get tree and find in roots
            const treeRes = await apiService.locations.getTree()
            const treeData = (treeRes.data as any)?.data ?? treeRes.data ?? []
            const foundId = findInTree(Array.isArray(treeData) ? treeData : [], name, type, parentId)
            if (foundId) return foundId
          }
        } catch (searchError) {
          console.warn("Failed to search for existing location:", searchError)
        }
        // If we still can't find it, the create might have succeeded, so throw original error
        throw error
      }
      throw error
    }
  }

  const handleAddLocation = async () => {
    if (!newLocation.label.trim()) {
      toast({ title: "Location hierarchy is required", variant: "destructive" })
      return
    }

    // Validate format (should contain > separator)
    if (!newLocation.label.includes(">")) {
      toast({
        title: "Invalid format",
        description: "Please use format: Country > State > City (e.g., Pakistan > Punjab > Lahore)",
        variant: "destructive",
      })
      return
    }

    setBusy(true)
    try {
      // Parse the hierarchy
      const parts = newLocation.label.split(">").map(p => p.trim()).filter(p => p.length > 0)
      
      if (parts.length === 0) {
        toast({ title: "Invalid format", description: "Please provide at least one location name", variant: "destructive" })
        return
      }

      // Create locations in tree hierarchy
      let parentId: string | null = null
      const createdIds: string[] = []

      for (let i = 0; i < parts.length; i++) {
        const locationName = parts[i]
        const levelType = LOCATION_LEVELS[Math.min(i, LOCATION_LEVELS.length - 1)]
        
        const locationId = await findOrCreateLocation(locationName, levelType, parentId)
        createdIds.push(locationId)
        parentId = locationId
      }

      // Also add to dropdown options for backward compatibility
      try {
        await apiService.advanced.createOption("property.location", {
          label: newLocation.label.trim(),
          value: newLocation.label.trim(),
          sortOrder: newLocation.sortOrder,
        })
      } catch (dropdownError) {
        // Ignore if dropdown option creation fails - tree creation is more important
        console.warn("Failed to create dropdown option:", dropdownError)
      }

      toast({ 
        title: "Location added successfully", 
        description: `Created ${parts.length} location level(s) in the hierarchy` 
      })
      setNewLocation({ label: "", value: "", sortOrder: 0 })
      
      // Refresh both systems - force revalidation for location tree
      await Promise.all([
        refreshOptions(), 
        refreshLocationTree({ revalidate: true })
      ])
    } catch (error: any) {
      toast({
        title: "Failed to add location",
        description: error?.response?.data?.error || error?.response?.data?.message || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const startEditing = (location: any) => {
    setEditingLocationId(location.id)
    setEditingPayload({
      label: location.label,
      value: location.value,
      sortOrder: location.sortOrder ?? 0,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingLocationId) return

    if (!editingPayload.label.trim()) {
      toast({ title: "Location hierarchy is required", variant: "destructive" })
      return
    }

    if (!editingPayload.label.includes(">")) {
      toast({
        title: "Invalid format",
        description: "Please use format: Country > State > City",
        variant: "destructive",
      })
      return
    }

    setBusy(true)
    try {
      await apiService.advanced.updateOption(editingLocationId, {
        label: editingPayload.label.trim(),
        value: editingPayload.label.trim(),
        sortOrder: editingPayload.sortOrder,
      })
      toast({ title: "Location updated" })
      setEditingLocationId(null)
      await refreshOptions()
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm("Remove this location?")) return
    setBusy(true)
    try {
      await apiService.advanced.deleteOption(id)
      toast({ title: "Location removed" })
      await refreshOptions()
    } catch (error: any) {
      toast({
        title: "Deletion failed",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  // Migrate existing dropdown locations to tree system
  const migrateDropdownToTree = async () => {
    if (sortedLocations.length === 0) {
      toast({ title: "No locations to migrate", description: "All locations are already in the tree system" })
      return
    }

    setBusy(true)
    try {
      let migrated = 0
      let skipped = 0

      for (const location of sortedLocations) {
        const parts = location.label.split(">").map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        if (parts.length === 0) continue

        try {
          // Check if this location path already exists in tree
          const findPathInTree = (nodes: any[], pathParts: string[], index: number, currentParentId: string | null): boolean => {
            if (index >= pathParts.length) return true
            
            const targetName = pathParts[index]
            const targetType = LOCATION_LEVELS[Math.min(index, LOCATION_LEVELS.length - 1)]
            
            for (const node of nodes) {
              if (node.name.toLowerCase() === targetName.toLowerCase() && 
                  node.type.toLowerCase() === targetType.toLowerCase() && 
                  node.parentId === currentParentId) {
                if (index === pathParts.length - 1) return true
                if (node.children) {
                  return findPathInTree(node.children, pathParts, index + 1, node.id)
                }
              }
            }
            return false
          }

          const exists = findPathInTree(locationTree || [], parts, 0, null)
          if (exists) {
            skipped++
            continue
          }

          // Create in tree
          let parentId: string | null = null
          for (let i = 0; i < parts.length; i++) {
            const locationName = parts[i]
            const levelType = LOCATION_LEVELS[Math.min(i, LOCATION_LEVELS.length - 1)]
            parentId = await findOrCreateLocation(locationName, levelType, parentId)
          }
          migrated++
        } catch (error) {
          console.warn(`Failed to migrate location: ${location.label}`, error)
        }
      }

      await refreshLocationTree({ revalidate: true })
      toast({ 
        title: "Migration complete", 
        description: `Migrated ${migrated} location(s), skipped ${skipped} existing location(s)` 
      })
    } catch (error: any) {
      toast({
        title: "Migration failed",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  // Ensure property.location category exists
  useEffect(() => {
    const ensureCategory = async () => {
      try {
        await apiService.advanced.getDropdownByKey("property.location")
      } catch (error: any) {
        // Category doesn't exist, create it
        if (error?.response?.status === 404) {
          try {
            await apiService.advanced.createCategory({
              key: "property.location",
              name: "Property Location",
              description: "Hierarchical location structure for properties (Country > State > City)",
            })
          } catch (createError) {
            // Ignore if already exists or permission denied
          }
        }
      }
    }
    ensureCategory()
  }, [])

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">Location Management</p>
          </div>
          <h2 className="text-2xl font-bold">Property Location Hierarchy</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage hierarchical locations for properties. Use format: Country &gt; State &gt; City
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => Promise.all([refreshOptions(), refreshLocationTree()])}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {sortedLocations.length > 0 && (
            <Button variant="outline" size="sm" onClick={migrateDropdownToTree} disabled={busy}>
              <Loader2 className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Migrate to Tree
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <Label>Existing Locations</Label>
          {loadingOptions && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading locations...
            </div>
          )}
          {!loadingOptions && sortedLocations.length === 0 && (
            <div className="text-center py-8 border rounded-lg">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No locations added yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first location using the form on the right</p>
            </div>
          )}
          <div className="space-y-3">
            {!loadingOptions &&
              sortedLocations.map((location) => {
                const isEditing = editingLocationId === location.id
                const parts = location.label.split(">").map((p: string) => p.trim())
                return (
                  <div
                    key={location.id}
                    className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div className="space-y-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Country > State > City"
                            value={editingPayload.label}
                            onChange={(event) => {
                              const hierarchy = event.target.value
                              setEditingPayload((prev) => ({
                                ...prev,
                                label: hierarchy,
                                value: hierarchy,
                              }))
                            }}
                          />
                          <Input
                            className="h-8 text-xs w-24"
                            type="number"
                            placeholder="Order"
                            value={editingPayload.sortOrder}
                            onChange={(event) =>
                              setEditingPayload((prev) => ({
                                ...prev,
                                sortOrder: Number(event.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 flex-wrap">
                            {parts.map((part: string, idx: number, arr: string[]) => (
                              <span key={idx}>
                                <span className="text-sm font-semibold text-foreground">{part}</span>
                                {idx < arr.length - 1 && <span className="text-muted-foreground mx-1">›</span>}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">Order: {location.sortOrder ?? 0}</p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {isEditing ? (
                        <>
                          <Button onClick={handleSaveEdit} size="sm" disabled={busy}>
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingLocationId(null)}
                            disabled={busy}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(location)}
                            title="Edit location"
                            disabled={busy}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLocation(location.id)}
                            title="Delete location"
                            disabled={busy}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 rounded-2xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add New Location</p>
            <div className="space-y-2">
              <Label className="text-xs">Location Hierarchy</Label>
              <Input
                placeholder="e.g., Pakistan > Punjab > Lahore"
                value={newLocation.label}
                onChange={(event) => {
                  const hierarchy = event.target.value
                  setNewLocation((prev) => ({
                    ...prev,
                    label: hierarchy,
                    value: hierarchy,
                  }))
                }}
              />
              <p className="text-xs text-muted-foreground">
                Use &gt; to separate levels: Country &gt; State &gt; City
              </p>
              <p className="text-xs text-muted-foreground font-medium">Examples:</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Pakistan &gt; Punjab &gt; Lahore</li>
                <li>Pakistan &gt; Sindh &gt; Karachi</li>
                <li>USA &gt; California &gt; Los Angeles</li>
              </ul>
            </div>
            <div className="space-y-2 mt-4">
              <Label className="text-xs">Sort Order</Label>
              <Input
                placeholder="0"
                type="number"
                value={newLocation.sortOrder}
                onChange={(event) =>
                  setNewLocation((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <Button
              className="w-full mt-4"
              size="sm"
              onClick={handleAddLocation}
              disabled={busy || !newLocation.label.trim()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Location
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

