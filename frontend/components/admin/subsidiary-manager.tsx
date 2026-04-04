"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, PlusCircle, Edit3, Trash2, RefreshCw, Building2, X, Upload, Image as ImageIcon } from "lucide-react"

type LocationOption = {
  id: string
  path: string
}

type SubsidiaryOption = {
  id: string
  name: string
  sortOrder: number
}

type Subsidiary = {
  id: string
  locationId: string
  name: string
  logoPath?: string | null
  locationPath: string
  location: {
    id: string
    name: string
  }
  options: SubsidiaryOption[]
}

export function SubsidiaryManager() {
  const { toast } = useToast()
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [subsidiaryOptions, setSubsidiaryOptions] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingOptions, setEditingOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [editingLogoFile, setEditingLogoFile] = useState<File | null>(null)
  const [editingLogoPreview, setEditingLogoPreview] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [locationsRes, subsidiariesRes] = await Promise.all([
        apiService.subsidiaries.getLocationsWithPaths().catch((err) => {
          console.warn('Failed to load locations:', err)
          return { data: { data: [] } }
        }),
        apiService.subsidiaries.getAll().catch((err) => {
          console.warn('Failed to load subsidiaries:', err)
          return { data: { data: [] } }
        }),
      ])

      const locationsData = (locationsRes.data as any)?.data || locationsRes.data || []
      const subsidiariesData = (subsidiariesRes.data as any)?.data || subsidiariesRes.data || []

      // Sort locations by path depth (shallow to deep) and then alphabetically
      // This ensures parent locations appear before their children
      const sortedLocations = Array.isArray(locationsData) 
        ? locationsData.slice().sort((a: LocationOption, b: LocationOption) => {
            const depthA = a.path.split(' > ').length
            const depthB = b.path.split(' > ').length
            if (depthA !== depthB) {
              return depthA - depthB
            }
            return a.path.localeCompare(b.path)
          })
        : []

      setLocations(sortedLocations)
      setSubsidiaries(Array.isArray(subsidiariesData) ? subsidiariesData : [])
    } catch (error: any) {
      console.error('Error loading data:', error)
      // Set empty arrays to prevent crashes
      setLocations([])
      setSubsidiaries([])
      toast({
        title: "Failed to load data",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddOption = () => {
    setSubsidiaryOptions([...subsidiaryOptions, ""])
  }

  const handleRemoveOption = (index: number) => {
    setSubsidiaryOptions(subsidiaryOptions.filter((_, i) => i !== index))
  }

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...subsidiaryOptions]
    updated[index] = value
    setSubsidiaryOptions(updated)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Logo file too large", description: "Maximum size is 5MB", variant: "destructive" })
        return
      }
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid file type", description: "Please select an image file", variant: "destructive" })
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleEditingLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Logo file too large", description: "Maximum size is 5MB", variant: "destructive" })
        return
      }
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid file type", description: "Please select an image file", variant: "destructive" })
        return
      }
      setEditingLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditingLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddSubsidiary = async () => {
    if (!selectedLocationId) {
      toast({ title: "Location is required", variant: "destructive" })
      return
    }

    const validOptions = subsidiaryOptions.filter((opt) => opt.trim())
    if (validOptions.length === 0) {
      toast({ title: "At least one subsidiary option is required", variant: "destructive" })
      return
    }

    setBusy(true)
    try {
      let logoPath: string | undefined = undefined

      // Upload logo if provided
      if (logoFile) {
        const formData = new FormData()
        formData.append('logo', logoFile)
        formData.append('locationId', selectedLocationId)
        formData.append('options', JSON.stringify(validOptions))

        // Get CSRF token and session ID from sessionStorage
        const csrfToken = sessionStorage.getItem('csrfToken')
        const sessionId = sessionStorage.getItem('sessionId')
        const deviceId = sessionStorage.getItem('deviceId')

        // Validate CSRF token exists before upload
        if (!csrfToken || !sessionId) {
          toast({
            title: "CSRF token missing",
            description: "Please refresh the page and try again",
            variant: "destructive",
          })
          setBusy(false)
          return
        }

        // Use FormData for file upload with CSRF headers
        // Normalize baseURL to prevent duplicate /api prefix
        const baseUrl = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, '')
        const response = await fetch(`${baseUrl}/api/subsidiaries`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
            ...(sessionId && { 'X-Session-Id': sessionId }),
            ...(deviceId && { 'X-Device-Id': deviceId }),
          },
          credentials: 'include', // Include cookies for session
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to create subsidiary' }))
          const errorMessage = error?.error || error?.message || 'Failed to create subsidiary'
          
          // If CSRF error, provide helpful message
          if (response.status === 403 && (errorMessage.includes('CSRF') || errorMessage.includes('Session ID'))) {
            throw new Error('CSRF protection failed. Please refresh the page and try again.')
          }
          
          throw new Error(errorMessage)
        }

        const result = await response.json()
        toast({ title: "Subsidiary added successfully" })
        setSelectedLocationId("")
        setSubsidiaryOptions([])
        setLogoFile(null)
        setLogoPreview(null)
        await loadData()
        return
      }

      // Create without logo
      await apiService.subsidiaries.create({
        locationId: selectedLocationId,
        options: validOptions,
      })
      toast({ title: "Subsidiary added successfully" })
      setSelectedLocationId("")
      setSubsidiaryOptions([])
      setLogoFile(null)
      setLogoPreview(null)
      await loadData()
    } catch (error: any) {
      toast({
        title: "Failed to add subsidiary",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const startEditing = (subsidiary: Subsidiary) => {
    setEditingId(subsidiary.id)
    setEditingOptions(subsidiary.options.map((opt) => opt.name))
    // Normalize baseURL to prevent duplicate /api prefix
    const baseUrl = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, '')
    setEditingLogoPreview(subsidiary.logoPath ? `${baseUrl}/api/secure-files?path=${encodeURIComponent(subsidiary.logoPath)}` : null)
    setEditingLogoFile(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingOptions([])
    setEditingLogoFile(null)
    setEditingLogoPreview(null)
  }

  const handleEditOptionChange = (index: number, value: string) => {
    const updated = [...editingOptions]
    updated[index] = value
    setEditingOptions(updated)
  }

  const handleAddEditOption = () => {
    setEditingOptions([...editingOptions, ""])
  }

  const handleRemoveEditOption = (index: number) => {
    setEditingOptions(editingOptions.filter((_, i) => i !== index))
  }

  const handleSaveEdit = async () => {
    if (!editingId) return

    const validOptions = editingOptions.filter((opt) => opt.trim())
    if (validOptions.length === 0) {
      toast({ title: "At least one subsidiary option is required", variant: "destructive" })
      return
    }

    setBusy(true)
    try {
      // Upload logo if new file provided
      if (editingLogoFile) {
        const formData = new FormData()
        formData.append('logo', editingLogoFile)
        formData.append('options', JSON.stringify(validOptions))

        // Get CSRF token and session ID from sessionStorage
        const csrfToken = sessionStorage.getItem('csrfToken')
        const sessionId = sessionStorage.getItem('sessionId')
        const deviceId = sessionStorage.getItem('deviceId')

        // Validate CSRF token exists before upload
        if (!csrfToken || !sessionId) {
          toast({
            title: "CSRF token missing",
            description: "Please refresh the page and try again",
            variant: "destructive",
          })
          setBusy(false)
          return
        }

        // Normalize baseURL to prevent duplicate /api prefix
        const baseUrl = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, '')
        const response = await fetch(`${baseUrl}/api/subsidiaries/${editingId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
            ...(sessionId && { 'X-Session-Id': sessionId }),
            ...(deviceId && { 'X-Device-Id': deviceId }),
          },
          credentials: 'include', // Include cookies for session
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to update subsidiary' }))
          const errorMessage = error?.error || error?.message || 'Failed to update subsidiary'
          
          // If CSRF error, provide helpful message
          if (response.status === 403 && (errorMessage.includes('CSRF') || errorMessage.includes('Session ID'))) {
            throw new Error('CSRF protection failed. Please refresh the page and try again.')
          }
          
          throw new Error(errorMessage)
        }

        toast({ title: "Subsidiary updated successfully" })
        setEditingId(null)
        setEditingOptions([])
        setEditingLogoFile(null)
        setEditingLogoPreview(null)
        await loadData()
        return
      }

      // Update without logo change
      await apiService.subsidiaries.update(editingId, {
        options: validOptions,
      })
      toast({ title: "Subsidiary updated successfully" })
      setEditingId(null)
      setEditingOptions([])
      setEditingLogoFile(null)
      setEditingLogoPreview(null)
      await loadData()
    } catch (error: any) {
      toast({
        title: "Failed to update subsidiary",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string, locationPath: string) => {
    if (!window.confirm(`Delete subsidiary for "${locationPath}"? This action cannot be undone.`)) return

    setBusy(true)
    try {
      await apiService.subsidiaries.delete(id)
      toast({ title: "Subsidiary deleted successfully" })
      await loadData()
    } catch (error: any) {
      toast({
        title: "Failed to delete subsidiary",
        description: error?.response?.data?.error || error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const selectedLocationPath = locations.find((loc) => loc.id === selectedLocationId)?.path || ""

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">Subsidiary Management</p>
          </div>
          <h2 className="text-2xl font-bold">Location-based Subsidiaries</h2>
          <p className="text-sm text-muted-foreground">
            Manage subsidiary options (e.g., Phase 1, Phase 2) for each location
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <Label>Existing Subsidiaries</Label>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subsidiaries...
            </div>
          )}
          {!loading && subsidiaries.length === 0 && (
            <div className="text-center py-8 border rounded-lg">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No subsidiaries added yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first subsidiary using the form on the right
              </p>
            </div>
          )}
          <div className="space-y-3">
            {!loading &&
              subsidiaries.map((subsidiary) => {
                const isEditing = editingId === subsidiary.id
                return (
                  <div
                    key={subsidiary.id}
                    className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {subsidiary.locationPath}
                        </span>
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          {/* Logo Upload for Editing */}
                          <div className="space-y-2">
                            <Label className="text-xs">Logo</Label>
                            <div className="flex items-center gap-2">
                              {editingLogoPreview && (
                                <div className="relative w-16 h-16 border rounded-md overflow-hidden">
                                  <img
                                    src={editingLogoPreview}
                                    alt="Logo preview"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              )}
                              <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted">
                                <Upload className="h-4 w-4" />
                                <span className="text-xs">Upload Logo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleEditingLogoChange}
                                  disabled={busy}
                                />
                              </label>
                            </div>
                            <p className="text-xs text-muted-foreground">Max 5MB, PNG/JPG</p>
                          </div>
                          {editingOptions.map((opt, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                className="h-8 text-xs"
                                placeholder="e.g., Phase 1"
                                value={opt}
                                onChange={(e) => handleEditOptionChange(idx, e.target.value)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveEditOption(idx)}
                                disabled={busy}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddEditOption}
                            disabled={busy}
                            className="w-full"
                          >
                            <PlusCircle className="h-3 w-3 mr-1" />
                            Add Option
                          </Button>
                          <div className="flex gap-2">
                            <Button onClick={handleSaveEdit} size="sm" disabled={busy}>
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={busy}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {subsidiary.logoPath && (
                            <div className="mb-2">
                              {/* Normalize baseURL to prevent duplicate /api prefix */}
                              {(() => {
                                const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '')
                                return (
                                  <img
                                    src={`${baseUrl}/api/secure-files?path=${encodeURIComponent(subsidiary.logoPath)}`}
                                    alt="Subsidiary logo"
                                    className="w-16 h-16 object-contain border rounded-md"
                                  />
                                )
                              })()}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {subsidiary.options.map((opt) => (
                              <span
                                key={opt.id}
                                className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                              >
                                {opt.name}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(subsidiary)}
                          title="Edit subsidiary"
                          disabled={busy}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(subsidiary.id, subsidiary.locationPath)}
                          title="Delete subsidiary"
                          disabled={busy}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 rounded-2xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add New Subsidiary
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Location</Label>
              <Select
                value={selectedLocationId}
                onValueChange={setSelectedLocationId}
                disabled={busy || loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading locations..." : "Select location"} />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      Loading locations...
                    </div>
                  ) : locations.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No locations available. Add locations in Advanced Options &gt; Location & Subsidiary.
                    </div>
                  ) : (
                    locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.path}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedLocationId && (
                <p className="text-xs text-muted-foreground">Selected: {selectedLocationPath}</p>
              )}
              {!loading && locations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add locations in Advanced Options &gt; Location & Subsidiary to create subsidiaries.
                </p>
              )}
            </div>

            {selectedLocationId && (
              <>
                {/* Logo Upload */}
                <div className="space-y-2 mt-4">
                  <Label className="text-xs">Logo (Optional)</Label>
                  <div className="flex items-center gap-2">
                    {logoPreview && (
                      <div className="relative w-16 h-16 border rounded-md overflow-hidden">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      <span className="text-xs">Upload Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                        disabled={busy}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">Max 5MB, PNG/JPG. Will be used as watermark in reports.</p>
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="text-xs">Subsidiary Options</Label>
                  {subsidiaryOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        placeholder="e.g., Phase 1"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        disabled={busy}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={busy}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    disabled={busy}
                    className="w-full"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    + Add Option
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Add multiple options like Phase 1, Phase 2, Phase 3, etc.
                  </p>
                </div>

                <Button
                  className="w-full mt-4"
                  size="sm"
                  onClick={handleAddSubsidiary}
                  disabled={busy || subsidiaryOptions.filter((o) => o.trim()).length === 0}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Subsidiary
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

