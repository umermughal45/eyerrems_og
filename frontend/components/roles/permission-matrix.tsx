"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ChevronDown,
  ChevronRight,
  Building2,
  DollarSign,
  Users,
  UserCircle,
  Home,
  Wrench,
  FileText,
  Shield,
  Loader2,
} from "lucide-react"
// Removed unused import

// Permission structure from backend
interface RolePermission {
  id: string
  roleId: string
  module: string
  submodule: string | null
  action: string
  granted: boolean
  createdAt: string
  createdBy: string | null
}

interface AvailablePermissions {
  [module: string]: string[]
}

interface PermissionMatrixProps {
  roleId: string
  roleName: string
  permissions: RolePermission[]
  availablePermissions?: AvailablePermissions
  loading?: boolean
  onPermissionsChange?: (permissions: Array<{
    module: string
    submodule?: string
    action: string
    granted: boolean
  }>) => void
  readOnly?: boolean
}

// Module icons mapping
const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  finance: DollarSign,
  properties: Building2,
  hr: Users,
  crm: UserCircle,
  tenants: Home,
  construction: Wrench,
  ai: FileText,
  audit: Shield,
}

// Standard actions
const STANDARD_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export']
const RESTRICTED_ACTIONS = ['override']

// Parse permission string into components
function parsePermission(permission: string): { module: string; submodule?: string; action: string } | null {
  const parts = permission.split('.')
  if (parts.length === 2) {
    return { module: parts[0], action: parts[1] }
  } else if (parts.length === 3) {
    return { module: parts[0], submodule: parts[1], action: parts[2] }
  }
  return null
}

// Build permission structure from available permissions
function buildPermissionStructure(availablePermissions: AvailablePermissions) {
  const structure: Record<string, {
    module: string
    submodules: Record<string, string[]>
    moduleActions: string[]
  }> = {}

  for (const [module, permissions] of Object.entries(availablePermissions)) {
    const moduleActions: string[] = []
    const submodules: Record<string, string[]> = {}

    for (const permission of permissions) {
      const parsed = parsePermission(permission)
      if (!parsed) continue

      if (parsed.submodule) {
        if (!submodules[parsed.submodule]) {
          submodules[parsed.submodule] = []
        }
        if (!submodules[parsed.submodule].includes(parsed.action)) {
          submodules[parsed.submodule].push(parsed.action)
        }
      } else {
        if (!moduleActions.includes(parsed.action)) {
          moduleActions.push(parsed.action)
        }
      }
    }

    structure[module] = {
      module,
      submodules,
      moduleActions,
    }
  }

  return structure
}

export function PermissionMatrix({
  roleId,
  roleName,
  permissions,
  availablePermissions = {},
  loading = false,
  onPermissionsChange,
  readOnly = false,
}: PermissionMatrixProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedSubmodules, setExpandedSubmodules] = useState<Set<string>>(new Set())
  const [localPermissions, setLocalPermissions] = useState<Map<string, boolean>>(new Map())

  // Build permission structure
  const permissionStructure = useMemo(() => {
    return buildPermissionStructure(availablePermissions)
  }, [availablePermissions])

  // Initialize local permissions from props
  useEffect(() => {
    const permMap = new Map<string, boolean>()
    for (const perm of permissions) {
      const key = perm.submodule
        ? `${perm.module}.${perm.submodule}.${perm.action}`
        : `${perm.module}.${perm.action}`
      permMap.set(key, perm.granted)
    }
    setLocalPermissions(permMap)
  }, [permissions])

  // Check if permission is granted
  const isPermissionGranted = (module: string, submodule: string | undefined, action: string): boolean => {
    const key = submodule ? `${module}.${submodule}.${action}` : `${module}.${action}`
    return localPermissions.get(key) ?? false
  }

  // Toggle permission
  const togglePermission = (module: string, submodule: string | undefined, action: string) => {
    if (readOnly) return

    const key = submodule ? `${module}.${submodule}.${action}` : `${module}.${action}`
    const newPermissions = new Map(localPermissions)
    newPermissions.set(key, !isPermissionGranted(module, submodule, action))
    setLocalPermissions(newPermissions)

    // Notify parent of changes
    if (onPermissionsChange) {
      const permissionArray = Array.from(newPermissions.entries()).map(([key, granted]) => {
        const parsed = parsePermission(key)
        if (!parsed) return null
        return {
          module: parsed.module,
          submodule: parsed.submodule,
          action: parsed.action,
          granted,
        }
      }).filter(Boolean) as Array<{
        module: string
        submodule?: string
        action: string
        granted: boolean
      }>
      onPermissionsChange(permissionArray)
    }
  }

  // Toggle all module permissions
  const toggleModulePermissions = (module: string, grant: boolean) => {
    if (readOnly) return

    const newPermissions = new Map(localPermissions)
    const structure = permissionStructure[module]
    if (!structure) return

    // Toggle module-level actions
    for (const action of structure.moduleActions) {
      const key = `${module}.${action}`
      newPermissions.set(key, grant)
    }

    // Toggle submodule actions
    for (const [submodule, actions] of Object.entries(structure.submodules)) {
      for (const action of actions) {
        const key = `${module}.${submodule}.${action}`
        newPermissions.set(key, grant)
      }
    }

    setLocalPermissions(newPermissions)

    // Notify parent
    if (onPermissionsChange) {
      const permissionArray = Array.from(newPermissions.entries()).map(([key, granted]) => {
        const parsed = parsePermission(key)
        if (!parsed) return null
        return {
          module: parsed.module,
          submodule: parsed.submodule,
          action: parsed.action,
          granted,
        }
      }).filter(Boolean) as Array<{
        module: string
        submodule?: string
        action: string
        granted: boolean
      }>
      onPermissionsChange(permissionArray)
    }
  }

  // Check if all module permissions are granted
  const areAllModulePermissionsGranted = (module: string): boolean => {
    const structure = permissionStructure[module]
    if (!structure) return false

    let allGranted = true

    // Check module-level actions
    for (const action of structure.moduleActions) {
      if (!isPermissionGranted(module, undefined, action)) {
        allGranted = false
        break
      }
    }

    if (!allGranted) return false

    // Check submodule actions
    for (const [submodule, actions] of Object.entries(structure.submodules)) {
      for (const action of actions) {
        if (!isPermissionGranted(module, submodule, action)) {
          allGranted = false
          break
        }
      }
      if (!allGranted) break
    }

    return allGranted
  }

  // Check if any module permissions are granted
  const areAnyModulePermissionsGranted = (module: string): boolean => {
    const structure = permissionStructure[module]
    if (!structure) return false

    // Check module-level actions
    for (const action of structure.moduleActions) {
      if (isPermissionGranted(module, undefined, action)) {
        return true
      }
    }

    // Check submodule actions
    for (const [submodule, actions] of Object.entries(structure.submodules)) {
      for (const action of actions) {
        if (isPermissionGranted(module, submodule, action)) {
          return true
        }
      }
    }

    return false
  }

  // Toggle module expansion
  const toggleModule = (module: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(module)) {
      newExpanded.delete(module)
    } else {
      newExpanded.add(module)
    }
    setExpandedModules(newExpanded)
  }

  // Toggle submodule expansion
  const toggleSubmodule = (module: string, submodule: string) => {
    const key = `${module}.${submodule}`
    const newExpanded = new Set(expandedSubmodules)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedSubmodules(newExpanded)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const modules = Object.keys(permissionStructure).sort()

  if (modules.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No permissions available
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {modules.map((module) => {
        const structure = permissionStructure[module]
        const Icon = MODULE_ICONS[module] || FileText
        const isExpanded = expandedModules.has(module)
        const allGranted = areAllModulePermissionsGranted(module)
        const anyGranted = areAnyModulePermissionsGranted(module)
        const moduleDisplayName = module.charAt(0).toUpperCase() + module.slice(1)

        return (
          <Card key={module} className="overflow-hidden">
            {/* Module Header */}
            <div className="p-4 bg-muted/30 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleModule(module)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{moduleDisplayName}</h3>
                  {anyGranted && (
                    <Badge variant="secondary" className="text-xs">
                      {allGranted ? "Full Access" : "Partial Access"}
                    </Badge>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleModulePermissions(module, !allGranted)}
                      className="text-xs"
                    >
                      {allGranted ? "Revoke All" : "Grant All"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Module Content */}
            {isExpanded && (
              <div className="p-4 space-y-4">
                {/* Module-level Actions */}
                {structure.moduleActions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Module Actions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {structure.moduleActions.map((action) => (
                        <div key={action} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${module}.${action}`}
                            checked={isPermissionGranted(module, undefined, action)}
                            onCheckedChange={() => togglePermission(module, undefined, action)}
                            disabled={readOnly}
                          />
                          <label
                            htmlFor={`${module}.${action}`}
                            className="text-sm text-foreground cursor-pointer capitalize"
                          >
                            {action}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submodules */}
                {Object.keys(structure.submodules).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Submodules</h4>
                    <div className="space-y-3">
                      {Object.entries(structure.submodules).map(([submodule, actions]) => {
                        const submoduleKey = `${module}.${submodule}`
                        const isSubmoduleExpanded = expandedSubmodules.has(submoduleKey)
                        const submoduleDisplayName = submodule.charAt(0).toUpperCase() + submodule.slice(1)

                        return (
                          <Card key={submodule} className="border border-border">
                            <div className="p-3 bg-muted/20">
                              <div className="flex items-center justify-between">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleSubmodule(module, submodule)}
                                >
                                  {isSubmoduleExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                                <h5 className="text-sm font-medium text-foreground flex-1 ml-2">
                                  {submoduleDisplayName}
                                </h5>
                              </div>
                            </div>
                            {isSubmoduleExpanded && (
                              <div className="p-3">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {actions.map((action) => (
                                    <div key={action} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${module}.${submodule}.${action}`}
                                        checked={isPermissionGranted(module, submodule, action)}
                                        onCheckedChange={() => togglePermission(module, submodule, action)}
                                        disabled={readOnly}
                                      />
                                      <label
                                        htmlFor={`${module}.${submodule}.${action}`}
                                        className="text-sm text-foreground cursor-pointer capitalize"
                                      >
                                        {action}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
