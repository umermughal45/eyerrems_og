"use client"

import { useState } from "react"
import { DropdownManager } from "@/components/admin/dropdown-manager"
import { AmenitiesManager } from "@/components/admin/amenities-manager"
import { LocationManager } from "@/components/admin/location-manager"
import { InstallmentTypeManager } from "@/components/admin/installment-type-manager"
import { BulkExport } from "@/components/admin/bulk-export"
import { BulkImport } from "@/components/admin/bulk-import"
import { BulkExcelExport } from "@/components/admin/bulk-excel-export"
import { BulkExcelImport } from "@/components/admin/bulk-excel-import"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FolderTree, MapPin, CreditCard, Star, Download, Settings, Building2 } from "lucide-react"
import { SubsidiaryManager } from "@/components/admin/subsidiary-manager"

export function AdvancedOptionsPage() {
  const [defaultRows, setDefaultRows] = useState(25)
  const [auditEnabled, setAuditEnabled] = useState(true)

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Advanced Options</p>
          <h1 className="text-3xl font-bold">System configuration hub</h1>
          <p className="text-sm text-muted-foreground">
            Update dropdown catalogs, amenities, and bulk data operations from a single admin console.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6 mb-6">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="location-subsidiary" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Location & Subsidiary</span>
            </TabsTrigger>
            <TabsTrigger value="installments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Installments</span>
            </TabsTrigger>
            <TabsTrigger value="amenities" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Amenities</span>
            </TabsTrigger>
            <TabsTrigger value="import-export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Import/Export</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-0">
            <DropdownManager />
          </TabsContent>

          <TabsContent value="location-subsidiary" className="mt-0 space-y-6">
            <LocationManager />
            <SubsidiaryManager />
          </TabsContent>

          <TabsContent value="installments" className="mt-0">
            <InstallmentTypeManager />
          </TabsContent>

          <TabsContent value="amenities" className="mt-0">
            <AmenitiesManager />
          </TabsContent>

          <TabsContent value="import-export" className="mt-0 space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">CSV Export/Import</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                <BulkExport />
                <BulkImport />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-4">Excel Export/Import (Multi-Sheet)</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                <BulkExcelExport />
                <BulkExcelImport />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <Card className="space-y-4 p-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Other Options (future)</p>
                <h2 className="text-2xl font-bold">Defaults & audit toggles</h2>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default rows per page</Label>
                  <Input
                    type="number"
                    value={defaultRows}
                    min={5}
                    onChange={(event) => setDefaultRows(Number(event.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls pagination defaults across dashboards. (Preview only - not yet persisted.)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Audit log streaming</span>
                    <Switch checked={auditEnabled} onCheckedChange={(value) => setAuditEnabled(Boolean(value))} />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, future releases will automatically stream audit logs to the UI.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}

