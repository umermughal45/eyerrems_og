"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, PlusCircle, Edit3, Trash2, RefreshCw, Calendar } from "lucide-react"
import { useDropdownOptions } from "@/hooks/use-dropdowns"

type InstallmentTypeForm = {
  label: string
  value: string
  sortOrder: number
}

export function InstallmentTypeManager() {
  const { toast } = useToast()
  const { options, isLoading: loadingOptions, mutate: refreshOptions } = useDropdownOptions("installment.type")
  const [newType, setNewType] = useState<InstallmentTypeForm>({ label: "", value: "", sortOrder: 0 })
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editingPayload, setEditingPayload] = useState<InstallmentTypeForm>({ label: "", value: "", sortOrder: 0 })
  const [busy, setBusy] = useState(false)

  const sortedTypes = options.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder || 0))

  const handleAddType = async () => {
    if (!newType.label.trim()) {
      toast({ title: "Installment type name is required", variant: "destructive" })
      return
    }

    setBusy(true)
    try {
      await apiService.advanced.createOption("installment.type", {
        label: newType.label.trim(),
        value: newType.label.trim().toLowerCase().replace(/\s+/g, "-"),
        sortOrder: newType.sortOrder,
      })
      toast({ title: "Installment type added successfully" })
      setNewType({ label: "", value: "", sortOrder: 0 })
      await refreshOptions()
    } catch (error: any) {
      toast({
        title: "Failed to add installment type",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const startEditing = (type: any) => {
    setEditingTypeId(type.id)
    setEditingPayload({
      label: type.label,
      value: type.value,
      sortOrder: type.sortOrder ?? 0,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingTypeId) return

    if (!editingPayload.label.trim()) {
      toast({ title: "Installment type name is required", variant: "destructive" })
      return
    }

    setBusy(true)
    try {
      await apiService.advanced.updateOption(editingTypeId, {
        label: editingPayload.label.trim(),
        value: editingPayload.label.trim().toLowerCase().replace(/\s+/g, "-"),
        sortOrder: editingPayload.sortOrder,
      })
      toast({ title: "Installment type updated" })
      setEditingTypeId(null)
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

  const handleDeleteType = async (id: string) => {
    if (!window.confirm("Remove this installment type?")) return
    setBusy(true)
    try {
      await apiService.advanced.deleteOption(id)
      toast({ title: "Installment type removed" })
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

  // Ensure installment.type category exists
  useEffect(() => {
    const ensureCategory = async () => {
      try {
        await apiService.advanced.getDropdownByKey("installment.type")
      } catch (error: any) {
        // Category doesn't exist, create it
        if (error?.response?.status === 404) {
          try {
            await apiService.advanced.createCategory({
              key: "installment.type",
              name: "Installment Type",
              description: "Types of payment installments (e.g., Monthly, Quarterly, Yearly)",
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
            <Calendar className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">Installment Type Management</p>
          </div>
          <h2 className="text-2xl font-bold">Payment Installment Types</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage installment types for payment plans (e.g., Monthly, Quarterly, Yearly).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshOptions()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <Label>Existing Installment Types</Label>
          {loadingOptions && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading installment types...
            </div>
          )}
          {!loadingOptions && sortedTypes.length === 0 && (
            <div className="text-center py-8 border rounded-lg">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No installment types added yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first installment type using the form on the right</p>
            </div>
          )}
          <div className="space-y-3">
            {!loadingOptions &&
              sortedTypes.map((type) => {
                const isEditing = editingTypeId === type.id
                return (
                  <div
                    key={type.id}
                    className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div className="space-y-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Installment Type Name"
                            value={editingPayload.label}
                            onChange={(event) => {
                              const name = event.target.value
                              setEditingPayload((prev) => ({
                                ...prev,
                                label: name,
                                value: name.toLowerCase().replace(/\s+/g, "-"),
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
                            <span className="text-sm font-semibold text-foreground">{type.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Order: {type.sortOrder ?? 0}</p>
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
                            onClick={() => setEditingTypeId(null)}
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
                            onClick={() => startEditing(type)}
                            title="Edit installment type"
                            disabled={busy}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteType(type.id)}
                            title="Delete installment type"
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add New Installment Type</p>
            <div className="space-y-2">
              <Label className="text-xs">Installment Type Name</Label>
              <Input
                placeholder="e.g., Monthly, Quarterly, Yearly"
                value={newType.label}
                onChange={(event) => {
                  const name = event.target.value
                  setNewType((prev) => ({
                    ...prev,
                    label: name,
                    value: name.toLowerCase().replace(/\s+/g, "-"),
                  }))
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the name of the installment type (e.g., Monthly, Quarterly, Yearly, Custom).
              </p>
            </div>
            <div className="space-y-2 mt-4">
              <Label className="text-xs">Sort Order</Label>
              <Input
                placeholder="0"
                type="number"
                value={newType.sortOrder}
                onChange={(event) =>
                  setNewType((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <Button
              className="w-full mt-4"
              size="sm"
              onClick={handleAddType}
              disabled={busy || !newType.label.trim()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Installment Type
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

