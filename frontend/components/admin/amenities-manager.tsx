"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Loader2, Check, Edit3, Trash2, PlusCircle } from "lucide-react"
import { useAmenities } from "@/hooks/use-amenities"

type AmenityForm = {
  name: string
  description: string
  icon: string
}

type AmenityEditPayload = AmenityForm & {
  isActive: boolean
}

type Amenity = {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  isActive: boolean
}

export function AmenitiesManager() {
  const { toast } = useToast()
  const { amenities, isLoading, mutate } = useAmenities()
  const [newAmenity, setNewAmenity] = useState<AmenityForm>({ name: "", description: "", icon: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingPayload, setEditingPayload] = useState<AmenityEditPayload>({
    name: "",
    description: "",
    icon: "",
    isActive: true,
  })
  const [busy, setBusy] = useState(false)

  const handleCreateAmenity = async () => {
    if (!newAmenity.name.trim()) {
      toast({ title: "Amenity name is required", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      await apiService.advanced.createAmenity(newAmenity)
      toast({ title: "Amenity added" })
      setNewAmenity({ name: "", description: "", icon: "" })
      await mutate()
    } catch (error: any) {
      toast({
        title: "Failed to add amenity",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const startEditing = (amenity: any) => {
    setEditingId(amenity.id)
    setEditingPayload({
      name: amenity.name,
      description: amenity.description || "",
      icon: amenity.icon || "",
      isActive: amenity.isActive,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    if (!editingPayload.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      await apiService.advanced.updateAmenity(editingId, editingPayload)
      toast({ title: "Amenity updated" })
      setEditingId(null)
      await mutate()
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

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this amenity?")) return
    setBusy(true)
    try {
      await apiService.advanced.deleteAmenity(id)
      toast({ title: "Amenity removed" })
      await mutate()
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

  const amenityList = amenities || []

  return (
    <Card className="space-y-4 p-6">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Property Amenities</p>
        <h2 className="text-2xl font-bold">Global amenities catalog</h2>
        <p className="text-sm text-muted-foreground">
          Add, edit, or retire amenities so the property forms always surface the correct selection.
        </p>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Create new amenity</Label>
          <Input
            placeholder="Name"
            value={newAmenity.name}
            onChange={(event) => setNewAmenity((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Textarea
            placeholder="Description"
            rows={2}
            value={newAmenity.description}
            onChange={(event) => setNewAmenity((prev) => ({ ...prev, description: event.target.value }))}
          />
          <Input
            placeholder="Icon (optional)"
            value={newAmenity.icon}
            onChange={(event) => setNewAmenity((prev) => ({ ...prev, icon: event.target.value }))}
          />
          <Button onClick={handleCreateAmenity} disabled={busy || !newAmenity.name.trim()} className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add amenity
          </Button>
        </div>

        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Existing amenities</Label>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}
          {!isLoading &&
            !amenityList.length && (
              <p className="text-xs text-muted-foreground">No amenities recorded. Create one to get started.</p>
            )}

          {amenityList.map((amenity: Amenity) => {
            const isEditing = editingId === amenity.id
            return (
              <div key={amenity.id} className="rounded-2xl border border-border p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Name"
                      value={editingPayload.name}
                      onChange={(event) => setEditingPayload((prev) => ({ ...prev, name: event.target.value }))}
                    />
                    <Textarea
                      placeholder="Description"
                      rows={2}
                      value={editingPayload.description}
                      onChange={(event) =>
                        setEditingPayload((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                    <Input
                      placeholder="Icon"
                      value={editingPayload.icon}
                      onChange={(event) => setEditingPayload((prev) => ({ ...prev, icon: event.target.value }))}
                    />
                    <div className="flex items-center justify-between">
                      <Switch
                        checked={editingPayload.isActive}
                        onCheckedChange={(checked) =>
                          setEditingPayload((prev) => ({ ...prev, isActive: Boolean(checked) }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{amenity.name}</p>
                        <p className="text-xs text-muted-foreground">{amenity.description || "—"}</p>
                      </div>
                      <Switch 
                        checked={amenity.isActive} 
                        onCheckedChange={async (checked) => {
                          try {
                            await apiService.advanced.updateAmenity(amenity.id, {
                              name: amenity.name,
                              description: amenity.description || "",
                              icon: amenity.icon || "",
                              isActive: checked,
                            })
                            await mutate()
                            toast({ title: "Amenity updated" })
                          } catch (error: any) {
                            toast({
                              title: "Update failed",
                              description: error?.response?.data?.error || error?.message || "Try again",
                              variant: "destructive",
                            })
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditing(amenity)}>
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(amenity.id)}
                        title="Delete amenity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

