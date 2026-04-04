"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Settings, Bell, Shield, Palette, Plug, Sliders, Save, Building2, Mail, Phone, MapPin, Download, Upload, AlertTriangle, Loader2, Trash2, RotateCcw, Globe, Key, Cloud, CheckCircle2, XCircle, Sun, Moon, LayoutDashboard } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useTheme } from "@/lib/theme-provider"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api"
import { useSettingsStore } from "@/lib/store/settings-store"
import { formatCurrency, convertAmount, cn } from "@/lib/utils"

const SETTINGS_KEY = "system_config"
const NOTIFICATIONS_KEY = "notifications"
const INTEGRATIONS_KEY = "integrations"

export function SettingsView() {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    companyName,
    companyEmail,
    supportPhone,
    companyAddress,
    companyLogo,
    notificationConfig,
    integrationConfig,
    currencies,
    activeCurrency,
    numberFormat,
    isLoading,
    isInitialized,
    initialize,
    setActiveCurrency,
    setNumberFormat,
    updateBranding,
    updateConfig
  } = useSettingsStore()

  const [localBranding, setLocalBranding] = useState({
    companyName: "",
    companyEmail: "",
    supportPhone: "",
    companyAddress: "",
    companyLogo: null as string | null,
    selectedCurrency: "PKR"
  })

  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [localNotifications, setLocalNotifications] = useState<any>({})
  const [localIntegrations, setLocalIntegrations] = useState<any>({})

  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("general")

  // Recycle Bin state
  const [recycleBinItems, setRecycleBinItems] = useState<any[]>([])
  const [recycleBinLoading, setRecycleBinLoading] = useState(false)
  const [recycleBinFilter, setRecycleBinFilter] = useState("all")
  const [entityTypes, setEntityTypes] = useState<any[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)

  // Advanced state
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [showClearDataDialog, setShowClearDataDialog] = useState(false)
  const [clearingData, setClearingData] = useState(false)

  // Initialize store and local state
  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isInitialized) {
      setLocalBranding({
        companyName: companyName || "",
        companyEmail: companyEmail || "",
        supportPhone: supportPhone || "",
        companyAddress: companyAddress || "",
        companyLogo: companyLogo || null,
        selectedCurrency: activeCurrency || "PKR"
      })

      setLogoPreview(companyLogo || null)

      setLocalNotifications(notificationConfig || {})
      setLocalIntegrations(integrationConfig || {})
    }
  }, [isInitialized, companyName, companyEmail, supportPhone, companyAddress, companyLogo, activeCurrency, notificationConfig, integrationConfig])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Validate Branding - Only Company Name is required
      if (!localBranding.companyName) {
        toast({ title: "Validation Error", description: "Company Name is required.", variant: "destructive" })
        setIsSaving(false)
        return
      }

      const settingsData = {
        ...localBranding
      }

      await Promise.all([
        updateBranding(settingsData),
        updateConfig('notificationConfig', localNotifications),
        updateConfig('integrationConfig', localIntegrations)
      ])

      toast({
        title: "Settings Saved",
        description: "Your configurations have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "An error occurred while saving settings.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const updateBrandingField = (field: string, value: string) => {
    setLocalBranding(prev => ({ ...prev, [field]: value }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" })
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setLogoPreview(base64String)
        setLocalBranding(prev => ({ ...prev, companyLogo: base64String }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoPreview(null)
    setLocalBranding(prev => ({ ...prev, companyLogo: null }))
  }

  const updateNotificationField = (field: string, value: any) => {
    setLocalNotifications((prev: any) => ({ ...prev, [field]: value }))
  }

  const updateIntegrationField = (category: string, field: string, value: any) => {
    setLocalIntegrations((prev: any) => ({
      ...prev,
      [category]: {
        ...prev?.[category],
        [field]: value
      }
    }))
  }

  // Recycle bin functions
  const loadRecycleBin = useCallback(async () => {
    try {
      setRecycleBinLoading(true)
      const params: any = { limit: 100 }
      if (recycleBinFilter !== "all") {
        params.entityType = recycleBinFilter
      }
      const response: any = await apiService.recycleBin?.getAll(params)
      const data = response?.data?.data || response?.data || []
      setRecycleBinItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to load recycle bin:", error)
      setRecycleBinItems([])
    } finally {
      setRecycleBinLoading(false)
    }
  }, [recycleBinFilter])

  const loadEntityTypes = useCallback(async () => {
    try {
      const response: any = await apiService.recycleBin?.getEntityTypes()
      const data = response?.data?.data || response?.data || []
      setEntityTypes(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to load entity types:", error)
    }
  }, [])

  const handleRestore = async (id: string, entityName: string) => {
    try {
      setRestoringId(id)
      await apiService.recycleBin?.restore(id)
      toast({
        title: "Restored Successfully",
        description: `"${entityName}" has been restored.`,
      })
      loadRecycleBin()
      loadEntityTypes()
    } catch (error: any) {
      toast({
        title: "Restore Failed",
        description: error?.response?.data?.error || "Failed to restore item.",
        variant: "destructive",
      })
    } finally {
      setRestoringId(null)
    }
  }

  useEffect(() => {
    if (activeTab === "recycle-bin") {
      loadRecycleBin()
      loadEntityTypes()
    }
  }, [activeTab, loadRecycleBin, loadEntityTypes])

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      await apiService.settings.clearCache()
      toast({ title: "Cache Cleared", description: "System cache has been successfully purged." })
    } catch (error) {
      toast({ title: "Error", description: "Failed to clear cache.", variant: "destructive" })
    } finally {
      setClearingCache(false)
    }
  }

  const handleGenerateReport = async () => {
    setGeneratingReport(true)
    try {
      const response = await apiService.settings.generateReport()
      toast({
        title: "Report Queued",
        description: response.data.message || "System report is being generated."
      })
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate system report.", variant: "destructive" })
    } finally {
      setGeneratingReport(false)
    }
  }

  if (isLoading || !isInitialized) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Use local state directly
  const notifications = localNotifications || {}
  const integrations = localIntegrations || {}

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">General Settings</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">Manage your company profile and preferences.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="shadow-sm bg-primary hover:bg-primary/90 h-9 px-6 rounded-md">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        {/* Navigation Tabs */}
        <div className="overflow-x-auto pb-2 no-scrollbar">
          <TabsList className="inline-flex min-w-full sm:min-w-0 h-auto p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
            {[
              { id: "general", label: "General Settings", icon: Settings },
              { id: "branding", label: "Branding", icon: Palette },
              { id: "notifications", label: "Notifications", icon: Bell },
              { id: "currency", label: "Currency Settings", icon: Globe },
              { id: "integrations", label: "Integrations", icon: Plug },
              { id: "recycle-bin", label: "Recycle Bin", icon: Trash2 },
              { id: "advanced", label: "Advanced / Reports", icon: Sliders },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap border-none",
                  "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm",
                  "dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-primary/70 dark:data-[state=active]:shadow-none",
                  "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Content Area */}
        <div className="w-full">
          {/* General Settings Tab */}
          <TabsContent value="general" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
            <Card className="border shadow-none rounded-xl overflow-hidden p-0 bg-white dark:bg-slate-950">
              <div className="p-8 space-y-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Branding</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="companyName" className="text-xs font-medium text-slate-600">Company Name</Label>
                        <Input
                          id="companyName"
                          placeholder="Acme Innovations, Inc."
                          className="h-10 bg-slate-50/50 border-slate-200 focus:ring-primary"
                          value={localBranding.companyName}
                          onChange={(e) => updateBrandingField("companyName", e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="companyEmail" className="text-xs font-medium text-slate-600">Company Email</Label>
                        <Input
                          id="companyEmail"
                          placeholder="support@acmeinnovations.com"
                          className="h-10 bg-slate-50/50 border-slate-200 focus:ring-primary"
                          value={localBranding.companyEmail || ""}
                          onChange={(e) => updateBrandingField("companyEmail", e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="companyPhone" className="text-xs font-medium text-slate-600">Company Phone</Label>
                        <Input
                          id="companyPhone"
                          placeholder="+1 (555) 123-4567"
                          className="h-10 bg-slate-50/50 border-slate-200 focus:ring-primary"
                          value={localBranding.supportPhone || ""}
                          onChange={(e) => updateBrandingField("supportPhone", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="companyAddress" className="text-xs font-medium text-slate-600">Company Address</Label>
                        <textarea
                          id="companyAddress"
                          rows={5}
                          placeholder="123 Business Parkway..."
                          className="flex min-h-[120px] w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                          value={localBranding.companyAddress || ""}
                          onChange={(e) => updateBrandingField("companyAddress", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                    <div className="space-y-4">
                      <Label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Company Logo</Label>
                      <div className="flex items-center gap-6">
                        <div className="relative group">
                          <div className="h-20 w-20 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-2xl font-bold text-slate-400 capitalize">{localBranding.companyName?.charAt(0) || "A"}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 rounded-md text-xs font-semibold border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Upload New Logo
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-4 rounded-md text-xs font-semibold border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-red-500"
                              onClick={handleRemoveLogo}
                              disabled={!logoPreview}
                            >
                              Remove Logo
                            </Button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              accept="image/*"
                              onChange={handleLogoUpload}
                            />
                          </div>
                          <Button
                            className="w-fit h-9 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-6"
                            onClick={handleSave}
                            disabled={isSaving}
                          >
                            {isSaving ? "Saving..." : "Change app logo"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 h-9 px-6 rounded-md shadow-sm"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Branding (Theme/Appearance) */}
          <TabsContent value="branding" className="mt-0 space-y-6 focus-visible:outline-none">
            <Card className="p-8 border shadow-none rounded-xl">
              <div className="flex items-center gap-2 mb-8 text-primary dark:text-primary/70">
                <Palette className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Appearance & Theme</h3>
              </div>

              <div className="grid gap-10">
                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Display Mode</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: "light", label: "Light", icon: Sun },
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "system", label: "System", icon: LayoutDashboard },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id as any)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 relative group",
                          theme === t.id
                            ? "border-primary bg-primary/100/5 text-primary shadow-sm"
                            : "border-slate-100 bg-white hover:border-primary/30 text-muted-foreground"
                        )}
                      >
                        <t.icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", theme === t.id && "animate-pulse")} />
                        <span className="text-xs font-bold uppercase tracking-wider">{t.label}</span>
                        {theme === t.id && <CheckCircle2 className="absolute top-2 right-2 h-3 w-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Global Number Formatting</Label>
                    <Badge variant={numberFormat === "compact" ? "default" : "secondary"} className="rounded-full px-4 text-[10px]">
                      {numberFormat === "compact" ? "Compact Shorthand" : "Full Display"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: "full", title: "Full Format", desc: "1,250,000.00", icon: Sliders },
                      { id: "compact", title: "Compact Mode", desc: "1.25M / 12.5L", icon: CheckCircle2 }
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setNumberFormat(fmt.id as any)}
                        className={cn(
                          "group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left",
                          numberFormat === fmt.id
                            ? "border-primary bg-primary/100/5 shadow-sm"
                            : "border-slate-100 bg-white hover:border-primary/30"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                          numberFormat === fmt.id ? "bg-primary/100 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-primary/20 group-hover:text-primary"
                        )}>
                          <fmt.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs mb-0.5 uppercase tracking-tight">{fmt.title}</h4>
                          <p className="font-mono text-[10px] text-primary font-bold">{fmt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="mt-0 space-y-6 focus-visible:outline-none">
            <Card className="p-8 border shadow-none rounded-xl">
              <div className="flex items-center gap-2 mb-8 text-primary dark:text-primary/70">
                <Bell className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Notification Settings</h3>
              </div>
              <div className="space-y-4">
                {[
                  { id: "emailEnabled", title: "Email Notifications", desc: "System alerts via Resend API" },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div>
                      <Label className="text-sm font-semibold">{item.title}</Label>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={localNotifications[item.id] || false}
                      onCheckedChange={(val) => updateNotificationField(item.id, val)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Currency */}
          <TabsContent value="currency" className="mt-0 space-y-6 focus-visible:outline-none">
            <Card className="p-8 border shadow-none rounded-xl">
              <div className="flex items-center gap-2 mb-8 text-primary dark:text-primary/70">
                <Globe className="h-5 w-5" />
                <h3 className="text-lg font-semibold">System Currency</h3>
              </div>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Global Identity</Label>
                  <Select
                    value={localBranding.selectedCurrency}
                    onValueChange={(val) => updateBrandingField("selectedCurrency", val)}
                  >
                    <SelectTrigger className="h-10 bg-slate-50/50">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { code: "USD", name: "US Dollar", symbol: "$" },
                        { code: "PKR", name: "Pakistani Rupee", symbol: "Rs" },
                        { code: "EUR", name: "Euro", symbol: "€" },
                        { code: "GBP", name: "British Pound", symbol: "£" },
                        ...currencies.slice(0, 10)
                      ].map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.code} - {c.symbol}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">This updates all financial symbols across the system in real-time.</p>
                </div>

                <div className="rounded-2xl bg-primary/5 p-6 border border-primary/20 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Master Currency</span>
                    <Badge className="bg-primary text-[10px]">{localBranding.selectedCurrency}</Badge>
                  </div>
                  <div className="text-2xl font-black text-primary-foreground">
                    {localBranding.selectedCurrency}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="mt-0 space-y-6 focus-visible:outline-none">
            <Card className="p-8 border shadow-none rounded-xl">
              <div className="flex items-center gap-2 mb-8 text-primary dark:text-primary/70">
                <Plug className="h-5 w-5" />
                <h3 className="text-lg font-semibold">API Integrations</h3>
              </div>

              <div className="space-y-6">
                <div className="p-6 border rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Mail className="h-4 w-4 text-primary" /></div>
                      <div>
                        <h4 className="font-bold text-sm">Resend API</h4>
                        <p className="text-[10px] text-muted-foreground">Modern email delivery configuration</p>
                      </div>
                    </div>
                    <Switch
                      checked={localIntegrations.resend?.enabled || false}
                      onCheckedChange={(val) => updateIntegrationField("resend", "enabled", val)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500">API Key</Label>
                    <Input
                      placeholder="re_..."
                      type="password"
                      value={localIntegrations.resend?.apiKey || ""}
                      onChange={(e) => updateIntegrationField("resend", "apiKey", e.target.value)}
                      className="h-9"
                    />
                    <p className="text-[10px] text-muted-foreground pt-1">This key is securely stored in your database and partially masked for your protection against exposure.</p>
                  </div>
                </div>

                <div className="p-6 border rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center"><Mail className="h-4 w-4 text-indigo-500" /></div>
                      <div>
                        <h4 className="font-bold text-sm">IMAP Incoming Sync</h4>
                        <p className="text-[10px] text-muted-foreground">Receive external emails directly into the software.</p>
                      </div>
                    </div>
                    <Switch
                      checked={localIntegrations.imap?.enabled || false}
                      onCheckedChange={(val) => updateIntegrationField("imap", "enabled", val)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500">IMAP Host</Label>
                      <Input
                        placeholder="imap.gmail.com"
                        value={localIntegrations.imap?.host || ""}
                        onChange={(e) => updateIntegrationField("imap", "host", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500">Port (Usually 993)</Label>
                      <Input
                        placeholder="993"
                        type="number"
                        value={localIntegrations.imap?.port || ""}
                        onChange={(e) => updateIntegrationField("imap", "port", parseInt(e.target.value) || 993)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500">Email Address (Username)</Label>
                      <Input
                        placeholder="youremail@gmail.com"
                        value={localIntegrations.imap?.user || ""}
                        onChange={(e) => updateIntegrationField("imap", "user", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500">Password (App Password highly recommended)</Label>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        value={localIntegrations.imap?.password || ""}
                        onChange={(e) => updateIntegrationField("imap", "password", e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch 
                      id="imap-tls"
                      checked={localIntegrations.imap?.tls !== false} // Default true
                      onCheckedChange={(val) => updateIntegrationField("imap", "tls", val)}
                    />
                    <Label htmlFor="imap-tls" className="text-xs font-medium text-slate-600">Use Secure TLS Connection (Recommended)</Label>
                  </div>

                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Recycle Bin */}
          <TabsContent value="recycle-bin" className="mt-0 focus-visible:outline-none">
            <Card className="p-8 border shadow-none rounded-xl min-h-[500px]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  <h3 className="text-lg font-semibold">Recycle Bin</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={loadRecycleBin} className="text-xs h-8"><RotateCcw className="h-3 w-3 mr-1" /> Refresh</Button>
              </div>

              <div className="space-y-4">
                <Select value={recycleBinFilter} onValueChange={setRecycleBinFilter}>
                  <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="All Modules" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {entityTypes.map((type) => (
                      <SelectItem key={type.type} value={type.type}>{type.label} ({type.count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="text-xs font-bold uppercase tracking-wider">Module</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider">Item ID</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider">Deleted On</TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recycleBinItems.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground text-xs italic">No items in recycle bin</TableCell></TableRow>
                      ) : (
                        recycleBinItems.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-medium text-xs text-primary">{item.entityType}</TableCell>
                            <TableCell className="text-xs font-mono">{item.entityId}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(item.deletedAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" className="h-7 px-3 text-[10px] font-bold text-primary hover:text-primary/90 hover:bg-primary/10" onClick={() => handleRestore(item.id, item.entityId)} disabled={restoringId === item.id}>
                                {restoringId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "RESTORE"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Advanced Controls */}
          <TabsContent value="advanced" className="mt-0 space-y-6 focus-visible:outline-none">
            <Card className="p-8 border shadow-none rounded-xl">
              <div className="flex items-center gap-2 mb-8 text-primary dark:text-primary/70">
                <Sliders className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Advanced Controls</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 border rounded-2xl space-y-4 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={handleGenerateReport}>
                  <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform"><Download className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-bold text-sm">System Report</h4>
                    <p className="text-[10px] text-muted-foreground">Generate configuration analysis</p>
                  </div>
                </div>

                <div className="p-6 border rounded-2xl space-y-4 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={handleClearCache}>
                  <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform"><RotateCcw className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-bold text-sm">Clear Cache</h4>
                    <p className="text-[10px] text-muted-foreground">Force refresh statistics</p>
                  </div>
                </div>

                <div className="p-6 border rounded-2xl space-y-4 hover:bg-red-50 border-red-100 transition-colors cursor-pointer md:col-span-2 group" onClick={() => setShowClearDataDialog(true)}>
                  <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform"><AlertTriangle className="h-5 w-5" /></div>
                  <div>
                    <h4 className="font-bold text-sm text-red-600">Factory Reset</h4>
                    <p className="text-[10px] text-red-400">Purge ALL system data (Irreversible)</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* Wipe Data Dialog */}
      <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              CRITICAL: Delete All System Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL properties, tenants, invoices, transactions and records.
              This action is irreversible. Users and core roles will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={async () => {
              setClearingData(true)
              try {
                await apiService.backup?.clearAll()
                toast({ title: "System Wiped", description: "All data has been deleted." })
                window.location.reload()
              } catch (e) {
                toast({ title: "Error", description: "Wipe failed.", variant: "destructive" })
              } finally {
                setClearingData(false)
              }
            }}>
              {clearingData ? "Clearing..." : "Yes, Purge Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
