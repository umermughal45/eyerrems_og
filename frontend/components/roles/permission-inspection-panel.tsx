"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Info, ChevronDown, ChevronRight, Download, Shield, User, Search, Filter, X } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"

// Type definitions matching backend
type ResolutionReason = 
  | 'EXPLICITLY_GRANTED'
  | 'NOT_GRANTED_TO_ROLE'
  | 'MODULE_ACCESS_DISABLED'
  | 'SYSTEM_RESTRICTED'
  | 'REQUIRES_HIGHER_ROLE'
  | 'INHERITED_DENY'

interface PermissionInspectionDetail {
  permission: string
  module: string
  submodule: string | null
  action: string
  status: 'allowed' | 'denied' | 'cannot_determine'
  source: 'explicit_grant' | 'explicit_deny' | 'inherited_role' | 'system_restriction' | 'deny_by_default' | 'legacy_migration' | 'cannot_determine'
  resolutionReason: ResolutionReason
  reason: string
  isSensitive: boolean
  auditRequired?: boolean
  lastUsed?: Date | null
  grantedAt?: Date | null
  grantedBy?: string | null
}

interface SubmoduleInspection {
  submodule: string
  permissions: PermissionInspectionDetail[]
}

interface ModuleInspection {
  module: string
  submodules: Record<string, SubmoduleInspection>
  moduleLevelPermissions: PermissionInspectionDetail[]
}

interface EffectiveAccessSummary {
  level: 'full' | 'partial' | 'restricted'
  description: string
  grantedVia: ('explicit' | 'legacy' | 'system')[]
  enforcementStatus: 'active' | 'compatibility_mode'
}

interface PermissionInspectionResult {
  inspectedEntity: {
    type: 'role' | 'user'
    id: string
    name: string
    roles?: string[]
  }
  inspectionMetadata: {
    timestamp: Date
    resolverVersion: string
    inspectorId?: string
    inspectorUsername?: string
  }
  effectiveAccess: EffectiveAccessSummary
  permissions: {
    modules: Record<string, ModuleInspection>
    summary: {
      totalPermissions: number
      effectiveAllowed: number
      explicitlyDefined: number
      systemRestricted: number
      sensitive: number
      cannotDetermine: number
    }
  }
  warnings: string[]
}

interface PermissionInspectionPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'role' | 'user'
  id: string
  name: string
}

const SENSITIVE_PERMISSIONS = [
  'ai.override_decision',
  'ai.view_explanations',
  'finance.modify_posted_entries',
  'finance.delete_transactions',
  'audit.view_logs',
]

// Helper function to format dates
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'Never'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString()
}

export function PermissionInspectionPanel({
  open,
  onOpenChange,
  type,
  id,
  name,
}: PermissionInspectionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PermissionInspectionResult | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedSubmodules, setExpandedSubmodules] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<'all' | 'granted' | 'denied'>('all')
  const [showSummary, setShowSummary] = useState(true)
  const { toast } = useToast()

  const loadInspection = async () => {
    setLoading(true)
    try {
      const response = await apiService.auth.inspectPermissions(type, id, 'Administrative inspection')
      setData(response.data)
      // Start with all modules collapsed - user can expand as needed
      setExpandedModules(new Set())
    } catch (error: any) {
      toast({
        title: "Inspection Failed",
        description: error.response?.data?.error || "Failed to load permission inspection",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleModule = (module: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(module)) {
      newExpanded.delete(module)
    } else {
      newExpanded.add(module)
    }
    setExpandedModules(newExpanded)
  }

  const toggleSubmodule = (key: string) => {
    const newExpanded = new Set(expandedSubmodules)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedSubmodules(newExpanded)
  }

  const exportToJSON = () => {
    if (!data) return
    
    // Add metadata header if legacy compatibility is active
    const exportData = {
      ...data,
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        note: data.effectiveAccess.enforcementStatus === 'compatibility_mode' 
          ? 'This export reflects effective permissions derived via legacy compatibility rules. Enforcement is active and secure.'
          : 'This export reflects effective permissions from explicit permission system.',
      },
    }
    
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `permission-inspection-${type}-${name}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({
      title: "Exported",
      description: "Permission inspection data exported to JSON",
    })
  }

  // Load inspection when dialog opens
  if (open && !data && !loading) {
    loadInspection()
  }

  // Filter permissions based on search and status
  const filterPermission = (permission: PermissionInspectionDetail): boolean => {
    const matchesSearch = searchQuery === "" || 
      permission.permission.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permission.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permission.action.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'granted' && permission.status === 'allowed') ||
      (statusFilter === 'denied' && permission.status !== 'allowed')
    
    return matchesSearch && matchesStatus
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col p-0">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 space-y-3">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Shield className="h-5 w-5" />
                  Permission Inspection
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Read-only view of effective permissions for <span className="font-medium">{name}</span>
                </DialogDescription>
              </div>
              <Button onClick={exportToJSON} variant="outline" size="sm" disabled={!data}>
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </DialogHeader>

          {/* Compact Header Info */}
          {data && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                {type === 'user' ? <User className="h-4 w-4 text-gray-500" /> : <Shield className="h-4 w-4 text-gray-500" />}
                <span className="font-medium">{data.inspectedEntity.name}</span>
                <Badge variant="outline" className="text-xs">{type}</Badge>
              </div>
              <div className="text-xs text-gray-500">
                v{data.inspectionMetadata.resolverVersion} • {formatDate(data.inspectionMetadata.timestamp)}
              </div>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSummary(!showSummary)}
                  className="text-xs"
                >
                  {showSummary ? 'Hide' : 'Show'} Summary
                </Button>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading inspection data...</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col px-6">
          {data && (
            <>
              {/* Collapsible Summary Section */}
              {showSummary && (
                <div className="space-y-3 py-4 border-b">
                  {/* Effective Access Summary - Compact */}
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Shield className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-blue-900 text-sm">Effective Access: {data.effectiveAccess.level.toUpperCase()}</span>
                        <span className="text-xs text-blue-700">• {data.effectiveAccess.description}</span>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {data.effectiveAccess.enforcementStatus === 'active' ? 'Active (Explicit Permissions)' : 'Compatibility Mode (Legacy Rules)'} • 
                        Granted via: {data.effectiveAccess.grantedVia.map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(', ') || 'Explicit'}
                      </div>
                    </div>
                  </div>

                  {/* Compact Summary Grid */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <div className="p-2 bg-white border rounded text-center">
                      <div className="text-lg font-bold text-gray-900">{data.permissions.summary.totalPermissions}</div>
                      <div className="text-xs text-gray-600">Total</div>
                    </div>
                    <div className="p-2 bg-green-50 border border-green-200 rounded text-center">
                      <div className="text-lg font-bold text-green-600">{data.permissions.summary.effectiveAllowed}</div>
                      <div className="text-xs text-green-700">Granted</div>
                    </div>
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-center">
                      <div className="text-lg font-bold text-blue-600">{data.permissions.summary.explicitlyDefined}</div>
                      <div className="text-xs text-blue-700">Explicit</div>
                    </div>
                    <div className="p-2 bg-orange-50 border border-orange-200 rounded text-center">
                      <div className="text-lg font-bold text-orange-600">{data.permissions.summary.systemRestricted}</div>
                      <div className="text-xs text-orange-700">Restricted</div>
                    </div>
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-center">
                      <div className="text-lg font-bold text-yellow-600">{data.permissions.summary.sensitive}</div>
                      <div className="text-xs text-yellow-700">Sensitive</div>
                    </div>
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded text-center">
                      <div className="text-lg font-bold text-gray-600">{data.permissions.summary.cannotDetermine}</div>
                      <div className="text-xs text-gray-700">Unknown</div>
                    </div>
                  </div>

                  {/* Warnings - Compact */}
                  {data.warnings && data.warnings.length > 0 && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs font-medium text-blue-800">Information</div>
                          <ul className="text-xs text-blue-700 mt-1 space-y-0.5">
                            {data.warnings.map((warning, idx) => (
                              <li key={idx}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Search and Filter Bar */}
              <div className="flex items-center gap-3 py-3 sticky top-0 bg-white z-10">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search permissions (e.g., finance.view, module, action)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9 h-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <div className="flex gap-1 border rounded-md">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        statusFilter === 'all' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setStatusFilter('granted')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        statusFilter === 'granted' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Granted
                    </button>
                    <button
                      onClick={() => setStatusFilter('denied')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        statusFilter === 'denied' 
                          ? 'bg-gray-600 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Denied
                    </button>
                  </div>
                </div>
              </div>

              {/* Resolved Permission Outcomes - Scrollable */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-2 pb-4">
                  {Object.entries(data.permissions.modules).map(([moduleName, module]) => {
                    // Filter permissions for this module
                    const filteredModulePerms = module.moduleLevelPermissions.filter(filterPermission)
                    const filteredSubmodules = Object.entries(module.submodules).map(([subName, sub]) => ({
                      name: subName,
                      submodule: sub,
                      filtered: sub.permissions.filter(filterPermission),
                    })).filter(item => item.filtered.length > 0)
                    
                    const totalFiltered = filteredModulePerms.length + filteredSubmodules.reduce((sum, s) => sum + s.filtered.length, 0)
                    
                    // Skip module if no permissions match filter
                    if (totalFiltered === 0) return null
                    
                    return (
                      <div key={moduleName} className="border rounded-lg overflow-hidden">
                        {/* Module Header */}
                        <button
                          onClick={() => toggleModule(moduleName)}
                          className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedModules.has(moduleName) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="font-semibold text-base capitalize">{moduleName}</span>
                            <Badge variant="outline" className="text-xs">
                              {totalFiltered} shown {totalFiltered !== 1 ? 'permissions' : 'permission'}
                            </Badge>
                          </div>
                        </button>

                        {expandedModules.has(moduleName) && (
                          <div className="border-t bg-gray-50/30 p-2.5 space-y-2">
                            {/* Module Policy Banner - Single line, non-repeating */}
                            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5">
                              <span className="font-medium">Default policy applied:</span>{' '}
                              Permissions are denied unless explicitly granted to this role
                            </div>
                            
                            {/* Module-level permissions */}
                            {filteredModulePerms.length > 0 && (
                              <div className="space-y-1.5">
                                {filteredModulePerms.map((perm) => (
                                  <PermissionDetailRow key={perm.permission} permission={perm} />
                                ))}
                              </div>
                            )}

                            {/* Submodule permissions */}
                            {filteredSubmodules.map(({ name: submoduleName, submodule, filtered }) => {
                              const key = `${moduleName}.${submoduleName}`
                              return (
                                <div key={submoduleName} className="border rounded-lg bg-white">
                                  <button
                                    onClick={() => toggleSubmodule(key)}
                                    className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      {expandedSubmodules.has(key) ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                      )}
                                      <span className="font-medium text-sm capitalize">{submoduleName}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {filtered.length} permission{filtered.length !== 1 ? 's' : ''}
                                      </Badge>
                                    </div>
                                  </button>

                                  {expandedSubmodules.has(key) && (
                                    <div className="border-t p-2 space-y-1.5">
                                      {filtered.map((perm) => (
                                        <PermissionDetailRow key={perm.permission} permission={perm} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PermissionDetailRow({ permission }: { permission: PermissionInspectionDetail }) {
  const isGranted = permission.status === 'allowed'
  
  // Visual styling: Granted stands out, denied is neutral
  const rowClasses = isGranted 
    ? 'border border-green-200 bg-green-50/50' 
    : 'border border-gray-200 bg-white'
  
  // Sensitive permissions get subtle yellow left border indicator
  const sensitiveBorder = permission.isSensitive ? 'border-l-4 border-l-yellow-400' : ''
  
  return (
    <div className={`rounded p-2.5 text-sm ${rowClasses} ${sensitiveBorder}`}>
      {/* Row 1: Permission Identifier + Effective Outcome */}
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="font-mono text-sm font-medium text-gray-900">{permission.permission}</span>
        
        {/* Effective Outcome Badge */}
        {isGranted ? (
          <Badge variant="default" className="bg-green-600 text-white text-xs font-medium">
            GRANTED
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-gray-600 border-gray-300 bg-gray-50">
            DENIED
          </Badge>
        )}
        
        {/* Explicit Grant label (only for granted permissions) */}
        {isGranted && (
          <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
            Explicit Grant
          </Badge>
        )}
        
        {/* Audit required badge (only when auditRequired is true) */}
        {permission.auditRequired && (
          <Badge 
            variant="outline" 
            className="text-xs bg-blue-50 text-blue-700 border-blue-300"
            title="Usage of this permission is logged with actor, timestamp, entity, and decision outcome"
          >
            <Shield className="h-3 w-3 mr-1" />
            Audited
          </Badge>
        )}
        
        {/* Sensitive badge */}
        {permission.isSensitive && (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Sensitive
          </Badge>
        )}
      </div>
      
      {/* Row 2: Primary Resolution Reason (enum) */}
      <div className="mb-1 text-xs text-gray-500 font-medium">
        {formatResolutionReasonForDisplay(permission.resolutionReason)}
      </div>
      
      {/* Row 3: Decision Explanation (human-readable) */}
      <div className="text-xs text-gray-700 leading-relaxed">
        {permission.reason || 'No explanation available'}
      </div>
      
      {/* Row 4: Additional metadata (if granted) - subtle, collapsible info */}
      {isGranted && permission.grantedAt && (
        <div className="text-xs text-gray-500 mt-1.5 pt-1.5 border-t border-gray-200/50">
          Granted {formatDate(permission.grantedAt)}
          {permission.grantedBy && ` by ${permission.grantedBy}`}
          {permission.lastUsed && (
            <> • Last used {formatDate(permission.lastUsed)}</>
          )}
        </div>
      )}
    </div>
  )
}

function formatResolutionReasonForDisplay(reason: ResolutionReason): string {
  // Inspection-only language: Explain decisions, not configuration
  const reasonMap: Record<ResolutionReason, string> = {
    EXPLICITLY_GRANTED: 'Granted via explicit permission assignment to this role',
    NOT_GRANTED_TO_ROLE: 'Denied — no explicit grant found for this role',
    MODULE_ACCESS_DISABLED: 'Denied — module access is disabled',
    SYSTEM_RESTRICTED: 'Denied — system restriction applies',
    REQUIRES_HIGHER_ROLE: 'Denied — requires a higher role level',
    INHERITED_DENY: 'Denied — inherited from parent policy',
  }
  return reasonMap[reason] || `Resolution: ${reason}`
}

