"use client"

import { useEffect, useMemo, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Loader2, PlusCircle, Edit3, Trash2, RefreshCw } from "lucide-react"
import { useDropdownCategories, useDropdownOptions } from "@/hooks/use-dropdowns"

type NewCategoryForm = {
  key: string
  name: string
  description: string
}

type NewOptionForm = {
  label: string
  value: string
  sortOrder: number
}

export function DropdownManager() {
  const { toast } = useToast()
  const { categories, isLoading: loadingCategories, mutate: refreshCategories } = useDropdownCategories()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { options, isLoading: loadingOptions, mutate: refreshOptions } = useDropdownOptions(selectedCategory ?? undefined)
  const [newCategory, setNewCategory] = useState<NewCategoryForm>({ key: "", name: "", description: "" })
  const [newOption, setNewOption] = useState<NewOptionForm>({ label: "", value: "", sortOrder: 0 })
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [editingPayload, setEditingPayload] = useState<NewOptionForm>({ label: "", value: "", sortOrder: 0 })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0].key)
    }
  }, [categories, selectedCategory])

  const sortedOptions = useMemo(() => {
    return options.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [options])

  const currentCategory = categories.find((category) => category.key === selectedCategory)

  const handleAddCategory = async () => {
    if (!newCategory.key || !newCategory.name) {
      toast({ title: "Category key and name are required", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      await apiService.advanced.createCategory(newCategory)
      toast({ title: "Category created" })
      setNewCategory({ key: "", name: "", description: "" })
      await refreshCategories()
    } catch (error: any) {
      toast({
        title: "Unable to create category",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleAddOption = async () => {
    if (!selectedCategory) {
      toast({ title: "Select a category first", variant: "destructive" })
      return
    }
    if (!newOption.label || !newOption.value) {
      toast({ title: "Label and value required", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      await apiService.advanced.createOption(selectedCategory, newOption)
      toast({ title: "Option added" })
      setNewOption({ label: "", value: "", sortOrder: 0 })
      await refreshOptions()
    } catch (error: any) {
      toast({
        title: "Failed to add option",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const startEditing = (option: any) => {
    setEditingOptionId(option.id)
    setEditingPayload({
      label: option.label,
      value: option.value,
      sortOrder: option.sortOrder ?? 0,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingOptionId) return
    setBusy(true)
    try {
      await apiService.advanced.updateOption(editingOptionId, editingPayload)
      toast({ title: "Option updated" })
      setEditingOptionId(null)
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

  const handleDeleteOption = async (id: string) => {
    if (!window.confirm("Remove this option?")) return
    setBusy(true)
    try {
      await apiService.advanced.deleteOption(id)
      toast({ title: "Option removed" })
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

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Editable Dropdowns</p>
          <h2 className="text-2xl font-bold">Centralized dropdown catalog</h2>
          <p className="text-sm text-muted-foreground">
            Create, edit, and delete dropdown values that power property, finance, and CRM forms in real time.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshCategories()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <Label>Choose a category</Label>
          <Select
            value={selectedCategory || ""}
            onValueChange={(value) => {
              setSelectedCategory(value)
              setEditingOptionId(null)
            }}
            disabled={loadingCategories}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingCategories ? "Loading categories..." : "Select category"} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.key} value={category.key}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!categories.length && !loadingCategories && (
            <p className="text-xs text-muted-foreground">
              No dropdown categories available. Add one using the side form.
            </p>
          )}

          <div className="space-y-3">
            {loadingOptions && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading options...
              </div>
            )}
            {!loadingOptions &&
              sortedOptions.map((option) => {
                const isEditing = editingOptionId === option.id
                return (
                  <div
                    key={option.id}
                    className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.value}</p>
                      <p className="text-xs text-muted-foreground">Order: {option.sortOrder ?? 0}</p>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {isEditing ? (
                        <>
                          <Input
                            className="h-8 !px-2 !py-1 text-xs"
                            placeholder="Label"
                            value={editingPayload.label}
                            onChange={(event) =>
                              setEditingPayload((prev) => ({ ...prev, label: event.target.value }))
                            }
                          />
                          <Input
                            className="h-8 !px-2 !py-1 text-xs"
                            placeholder="Value"
                            value={editingPayload.value}
                            onChange={(event) =>
                              setEditingPayload((prev) => ({ ...prev, value: event.target.value }))
                            }
                          />
                          <Input
                            className="h-8 !px-2 !py-1 text-xs"
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
                          <Button onClick={handleSaveEdit} size="sm">
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingOptionId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(option)}
                            title="Edit option"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOption(option.id)}
                            title="Delete option"
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add new category</p>
            <Input
              placeholder="Key e.g., property.status"
              value={newCategory.key}
              onChange={(event) => setNewCategory((prev) => ({ ...prev, key: event.target.value }))}
            />
            <Input
              placeholder="Human label"
              value={newCategory.name}
              onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newCategory.description}
              onChange={(event) => setNewCategory((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
            />
            <Button
              onClick={handleAddCategory}
              className="w-full"
              disabled={busy || !newCategory.key || !newCategory.name}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create category
            </Button>
          </div>

          <div className="space-y-2 rounded-2xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add option</p>
            <Input
              placeholder="Label"
              value={newOption.label}
              onChange={(event) => setNewOption((prev) => ({ ...prev, label: event.target.value }))}
            />
            <Input
              placeholder="Value"
              value={newOption.value}
              onChange={(event) => setNewOption((prev) => ({ ...prev, value: event.target.value }))}
            />
            <Input
              placeholder="Sort order"
              type="number"
              value={newOption.sortOrder}
              onChange={(event) =>
                setNewOption((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))
              }
            />
            <Button
              className="w-full"
              size="sm"
              onClick={handleAddOption}
              disabled={busy || !newOption.label || !newOption.value || !selectedCategory}
            >
              Add Option
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

