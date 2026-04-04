"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Users,
  Plus,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  Shield,
  Bell,
  X,
  Building2,
  DollarSign,
  UserCircle,
  Home,
  AlertTriangle,
  Info,
  ArrowLeft,
} from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { PermissionMatrix } from "./permission-matrix"
import { PermissionInspectionPanel } from "./permission-inspection-panel"

interface Role {
  id: string
  name: string
  status?: string // PART 1: Role lifecycle state (ACTIVE | DEACTIVATED | SYSTEM_LOCKED)
  permissions: string[]
  explicitPermissions?: string[] // Explicit permissions from backend
  availablePermissions?: Record<string, string[]> // Available permissions structure
  hasExplicitPermissions?: boolean // Whether role has explicit permissions
  defaultPassword?: string | null // Hashed password - null means not set
  createdAt: string
  updatedAt: string
  _count?: {
    users: number
    inviteLinks: number
    rolePermissions?: number
  }
}

interface InviteLink {
  id: string
  roleId: string
  username: string
  email: string
  message?: string
  token: string
  status: string
  inviteUrl?: string
  createdAt: string
  expiresAt?: string
}

const AVAILABLE_PERMISSIONS = [
  { id: "hr.view", label: "HR - View" },
  { id: "hr.create", label: "HR - Create" },
  { id: "hr.update", label: "HR - Update" },
  { id: "hr.delete", label: "HR - Delete" },
  { id: "crm.view", label: "CRM - View" },
  { id: "crm.create", label: "CRM - Create" },
  { id: "crm.update", label: "CRM - Update" },
  { id: "crm.delete", label: "CRM - Delete" },
  { id: "properties.view", label: "Properties - View" },
  { id: "properties.create", label: "Properties - Create" },
  { id: "properties.update", label: "Properties - Update" },
  { id: "properties.delete", label: "Properties - Delete" },
  { id: "finance.view", label: "Finance - View" },
  { id: "finance.create", label: "Finance - Create" },
  { id: "finance.update", label: "Finance - Update" },
  { id: "finance.delete", label: "Finance - Delete" },
  { id: "tenant.view", label: "Tenant - View" },
  { id: "tenant.update", label: "Tenant - Update" },
]

interface RoleUser {
  id: string
  username: string
  email: string
  createdAt: string
}

export function RolesView() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false)
  const [showRoleSelectionDialog, setShowRoleSelectionDialog] = useState(false)
  const [showInspectionPanel, setShowInspectionPanel] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null)
  const [showInviteLinkDialog, setShowInviteLinkDialog] = useState(false)
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [deactivatingRole, setDeactivatingRole] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [pendingPermissions, setPendingPermissions] = useState<string[] | null>(null) // Track pending permission changes
  const [savingPermissions, setSavingPermissions] = useState(false) // Track saving state
  const [explicitPermissions, setExplicitPermissions] = useState<any[]>([]) // Explicit permissions from backend
  const [availablePermissions, setAvailablePermissions] = useState<Record<string, string[]>>({}) // Available permissions structure
  const [loadingPermissions, setLoadingPermissions] = useState(false) // Loading state for permissions
  const [pendingExplicitPermissions, setPendingExplicitPermissions] = useState<Array<{
    module: string
    submodule?: string
    action: string
    granted: boolean
  }> | null>(null) // Pending explicit permission changes

  // Create role form
  const [createRoleData, setCreateRoleData] = useState({
    roleName: "",
    username: "",
    email: "",
    password: "",
    phoneNumber: "",
  })
  const [selectedDefaultRole, setSelectedDefaultRole] = useState<string | null>(null)

  // Invite link form
  const [inviteData, setInviteData] = useState({
    roleId: "",
    username: "",
    email: "",
    message: "",
  })
  const [inviteRoleUsers, setInviteRoleUsers] = useState<RoleUser[]>([])
  const [loadingInviteUsers, setLoadingInviteUsers] = useState(false)
  const [selectedInviteUser, setSelectedInviteUser] = useState<RoleUser | null>(null)
  const [generatingInvite, setGeneratingInvite] = useState(false)

  useEffect(() => {
    fetchRoles()
    fetchNotifications()
    
    // Poll for new notifications every 5 seconds
    const notificationInterval = setInterval(() => {
      fetchNotifications()
    }, 5000)
    
    return () => clearInterval(notificationInterval)
  }, [])

  // Mark all notifications as read when notification panel is opened
  useEffect(() => {
    if (showNotifications) {
      const markAllAsRead = async () => {
        const unreadNotifications = notifications.filter((n) => !n.read)
        if (unreadNotifications.length > 0) {
          try {
            await Promise.all(
              unreadNotifications.map((n) =>
                apiService.auth.markNotificationRead(n.id)
              )
            )
            // Update local state
            setNotifications((prev) =>
              prev.map((n) => ({ ...n, read: true }))
            )
          } catch (error) {
            console.error("Failed to mark notifications as read:", error)
          }
        }
      }
      markAllAsRead()
    }
  }, [showNotifications])

  useEffect(() => {
    if (selectedRole) {
      fetchRoleUsers()
    }
  }, [selectedRole])

  const fetchRoles = async () => {
    try {
      setLoading(true)
      const response = await apiService.auth.getRoles()
      const rolesData = (response.data as Role[]) || []
      
      // Filter roles: Only show Admin and roles that have users or invite links
      const filteredRoles = rolesData.filter(
        (role) =>
          role.name?.toLowerCase() === "admin" ||
          (role._count?.users || 0) > 0 ||
          (role._count?.inviteLinks || 0) > 0
      )
      
      setRoles(filteredRoles)
      if (filteredRoles.length > 0 && !selectedRole) {
        setSelectedRole(filteredRoles[0])
      }
    } catch (error: any) {
      console.error("Failed to fetch roles:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to fetch roles",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchRoleUsers = async () => {
    if (!selectedRole) return
    
    // Only fetch users if user is admin
    if (user?.role?.toLowerCase() !== "admin") {
      setRoleUsers([])
      return
    }

    try {
      setLoadingUsers(true)
      const response = await apiService.auth.getUsersByRole(selectedRole.id)
      setRoleUsers((response.data as RoleUser[]) || [])
    } catch (error: any) {
      console.error("Failed to fetch role users:", error)
      // Don't show error toast for 403 errors (permission denied)
      if (error.response?.status !== 403) {
        toast({
          title: "Error",
          description: error.response?.data?.error || "Failed to fetch users",
          variant: "destructive",
        })
      }
      setRoleUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const response = await apiService.auth.getNotifications()
      const allNotifications = (response.data as any[]) || []
      // Filter out approval messages, only show login notifications
      const loginNotifications = allNotifications.filter(
        (n) => 
          !n.title?.toLowerCase().includes('approval') && 
          !n.message?.toLowerCase().includes('approval') &&
          (n.title?.toLowerCase().includes('login') || n.message?.toLowerCase().includes('logged in'))
      )
      setNotifications(loginNotifications)
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  const handleSelectDefaultRole = (roleName: string) => {
    setSelectedDefaultRole(roleName)
    setCreateRoleData({
      ...createRoleData,
      roleName: roleName,
    })
  }

  const handleCreateRole = async () => {
    if (!createRoleData.roleName.trim()) {
      toast({
        title: "Error",
        description: "Please select a role or enter a custom role name",
        variant: "destructive",
      })
      return
    }

    if (!createRoleData.username.trim()) {
      toast({
        title: "Error",
        description: "Username is required",
        variant: "destructive",
      })
      return
    }

    if (!createRoleData.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      })
      return
    }

    if (!createRoleData.password || createRoleData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      })
      return
    }

    try {
      const payload: any = {
        name: createRoleData.roleName,
        username: createRoleData.username,
        email: createRoleData.email,
        password: createRoleData.password,
      }
      
      // Only include phoneNumber if it's not empty
      if (createRoleData.phoneNumber && createRoleData.phoneNumber.trim()) {
        payload.phoneNumber = createRoleData.phoneNumber.trim()
      }

      // Set permissions based on role
      if (createRoleData.roleName === "Admin") {
        payload.permissions = ["*"] // Full access
      } else if (createRoleData.roleName === "Dealer") {
        payload.permissions = ["crm.view", "crm.create", "crm.update", "properties.view"]
      } else if (createRoleData.roleName === "Tenant") {
        payload.permissions = ["tenant.view", "tenant.update"]
      } else if (createRoleData.roleName === "HR Manager") {
        payload.permissions = ["hr.view", "hr.create", "hr.update", "hr.delete"]
      } else if (createRoleData.roleName === "Accountant") {
        payload.permissions = ["finance.view", "finance.create", "finance.update", "finance.delete"]
      }
      
      const response = await apiService.auth.createRole(payload)

      toast({
        title: "Success",
        description: "Role and user created successfully",
      })

      setShowCreateRoleDialog(false)
      setShowRoleSelectionDialog(false)
      setCreateRoleData({
        roleName: "",
        username: "",
        email: "",
        password: "",
        phoneNumber: "",
      })
      setSelectedDefaultRole(null)
      await fetchRoles()
    } catch (error: any) {
      console.error("Failed to create role:", error)
      console.error("Error response:", error.response?.data)
      console.error("Request payload:", {
        name: createRoleData.roleName,
        username: createRoleData.username,
        email: createRoleData.email,
        password: createRoleData.password ? "***" : "",
        phoneNumber: createRoleData.phoneNumber,
      })
      
      let errorMessage = "Failed to create role"
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        } else if (error.response.data.details) {
          if (Array.isArray(error.response.data.details)) {
            errorMessage = error.response.data.details.map((d: any) => d.message || d).join(', ')
          } else {
            errorMessage = JSON.stringify(error.response.data.details)
          }
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleRoleSelection = async (roleName: string) => {
    try {
      // Fetch all roles (including hidden ones) to find the role
      const response = await apiService.auth.getRoles()
      const allRoles = (response.data as Role[]) || []
      const role = allRoles.find((r) => r.name?.toLowerCase() === roleName.toLowerCase())
      
      if (role) {
        // Open invite dialog with role pre-selected
        setInviteData({
          roleId: role.id,
          username: "",
          email: "",
          message: "",
        })
        setSelectedInviteUser(null)
        setShowRoleSelectionDialog(false)
        setShowInviteDialog(true)
        // Fetch users for this role
        fetchInviteRoleUsers(role.id)
      } else {
        toast({
          title: "Error",
          description: `${roleName} role not found. Please create it first.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Failed to fetch roles:", error)
      toast({
        title: "Error",
        description: "Failed to fetch roles",
        variant: "destructive",
      })
    }
  }

  const handleCustomRole = () => {
    setShowRoleSelectionDialog(false)
    setCreateRoleData({
      roleName: "",
      username: "",
      email: "",
      password: "",
      phoneNumber: "",
    })
    setSelectedDefaultRole(null)
    setShowCreateRoleDialog(true)
  }

  const fetchInviteRoleUsers = async (roleId: string) => {
    if (!roleId) {
      setInviteRoleUsers([])
      return
    }
    
    try {
      setLoadingInviteUsers(true)
      const response = await apiService.auth.getUsersByRole(roleId)
      setInviteRoleUsers((response.data as RoleUser[]) || [])
    } catch (error: any) {
      console.error("Failed to fetch role users:", error)
      setInviteRoleUsers([])
    } finally {
      setLoadingInviteUsers(false)
    }
  }

  const handleInviteRoleChange = (roleId: string) => {
    setInviteData({ ...inviteData, roleId, username: "", email: "" })
    setSelectedInviteUser(null)
    if (roleId) {
      fetchInviteRoleUsers(roleId)
    } else {
      setInviteRoleUsers([])
    }
  }

  const handleSelectInviteUser = (user: RoleUser) => {
    setSelectedInviteUser(user)
    setInviteData({
      ...inviteData,
      username: user.username,
      email: user.email,
    })
  }

  const handleGenerateInviteLink = async () => {
    console.log("Generate invite link clicked", inviteData)
    
    if (!inviteData.roleId) {
      toast({
        title: "Error",
        description: "Please select a role",
        variant: "destructive",
      })
      return
    }

    if (!inviteData.username || !inviteData.email) {
      toast({
        title: "Error",
        description: "Username and email are required",
        variant: "destructive",
      })
      return
    }

    try {
      setGeneratingInvite(true)
      
      const payload: any = {
        roleId: inviteData.roleId,
        username: inviteData.username.trim(),
        email: inviteData.email.trim(),
      }
      
      // Password will use role's default password (set during role creation)
      // No need to include password in payload
      
      if (inviteData.message && inviteData.message.trim()) {
        payload.message = inviteData.message.trim()
      }
      
      console.log("Sending payload:", payload)
      
      const response = await apiService.auth.generateInviteLink(payload)
      
      console.log("Response received:", response.data)

      // Show invite URL in a dialog
      const responseData = response.data as any
      if (responseData?.inviteUrl) {
        // Store the generated invite link
        setGeneratedInviteLink(responseData.inviteUrl)
        
        // Store temporary password for auto-fill (only if provided)
        // This will be used when user clicks the invite link
        if (responseData?.tempPassword && responseData?.token) {
          // Store password temporarily in sessionStorage for auto-fill
          // Key format: invite_password_<token>
          sessionStorage.setItem(`invite_password_${responseData.token}`, responseData.tempPassword)
        }
        
        // Close the generate dialog and open the link display dialog
        setShowInviteDialog(false)
        setShowInviteLinkDialog(true)
        
        // Also copy to clipboard
        navigator.clipboard.writeText(responseData.inviteUrl)
        toast({
          title: "Invite Link Generated",
          description: "The invite link has been copied to your clipboard",
        })
      } else {
        toast({
          title: "Success",
          description: "Invite link generated successfully",
        })
      }

      // Refresh roles to show newly created role
      await fetchRoles()

      setInviteData({
        roleId: "",
        username: "",
        email: "",
        message: "",
      })
      setSelectedInviteUser(null)
      setInviteRoleUsers([])
    } catch (error: any) {
      console.error("Failed to generate invite link:", error)
      console.error("Error response:", error.response?.data)
      console.error("Error status:", error.response?.status)
      console.error("Full error:", JSON.stringify(error.response?.data, null, 2))
      
      let errorMessage = "Failed to generate invite link"
      if (error.response?.data) {
        // Prefer message over error for more detailed information
        if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        } else if (error.response.data.details) {
          if (Array.isArray(error.response.data.details)) {
            errorMessage = error.response.data.details.map((d: any) => d.message || d).join(', ')
          }
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setGeneratingInvite(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(text)
    setTimeout(() => setCopiedToken(null), 2000)
    toast({
      title: "Copied",
      description: "Link copied to clipboard",
    })
  }

  const copyInviteLink = () => {
    if (generatedInviteLink) {
      copyToClipboard(generatedInviteLink)
    }
  }

  // PART 1: Handle role deactivation (hard block if users exist)
  const handleDeactivateRole = async () => {
    if (!selectedRole) return

    // Hard block: Cannot deactivate if users exist
    const activeUsersCount = selectedRole._count?.users || 0
    if (activeUsersCount > 0) {
      toast({
        title: "Deactivation Blocked",
        description: `Cannot deactivate role with ${activeUsersCount} active user(s). All users must be reassigned before deactivation.`,
        variant: "destructive",
      })
      return
    }

    // No users, can deactivate immediately
    try {
      setDeactivatingRole(true)
      await apiService.auth.deactivateRole(selectedRole.id, {
        reason: 'Role deactivated by administrator',
      })

      toast({
        title: "Success",
        description: `Role "${selectedRole.name}" has been deactivated`,
      })

      // Refresh roles
      await fetchRoles()
      setShowDeactivateDialog(false)
      
      // Clear selection if deactivated role was selected
      const updatedRoles = await apiService.auth.getRoles()
      const updatedRole = (updatedRoles.data as Role[]).find(r => r.id === selectedRole.id)
      if (updatedRole?.status === 'DEACTIVATED') {
        setSelectedRole(updatedRole)
      }
    } catch (error: any) {
      console.error("Failed to deactivate role:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || error.response?.data?.message || "Failed to deactivate role",
        variant: "destructive",
      })
    } finally {
      setDeactivatingRole(false)
    }
  }

  // Check if role has access to a module (check pending permissions if available)
  const hasModuleAccess = (permissions: string[], module: string): boolean => {
    const permsToCheck = pendingPermissions || permissions
    // Admin has all permissions with '*' wildcard
    if (permsToCheck.includes('*')) return true
    return permsToCheck.some((p) => p.startsWith(`${module}.`))
  }

  // Toggle module access - updates local state only, doesn't save
  const toggleModuleAccess = (module: string, enabled: boolean) => {
    if (!selectedRole || selectedRole.name?.toLowerCase() === "admin") return

    const modulePermissions = [
      `${module}.view`,
      `${module}.create`,
      `${module}.update`,
      `${module}.delete`,
    ]

    const currentPermissions = pendingPermissions || (selectedRole.permissions as string[]) || []
    let updatedPermissions: string[]
    
    if (enabled) {
      // Add module permissions
      updatedPermissions = [
        ...currentPermissions.filter(
          (p) => !modulePermissions.includes(p)
        ),
        ...modulePermissions,
      ]
    } else {
      // Remove module permissions
      updatedPermissions = currentPermissions.filter(
        (p) => !modulePermissions.includes(p)
      )
    }

    // Update pending permissions (local state only)
    setPendingPermissions(updatedPermissions)
  }

  // Save pending permission changes (legacy)
  const savePermissions = async () => {
    if (!selectedRole || !pendingPermissions) return

    setSavingPermissions(true)
    const originalPermissions = (selectedRole.permissions as string[]) || []

    try {
      // Save to backend
      const response = await apiService.auth.updateRole(selectedRole.id, {
        permissions: pendingPermissions,
      })

      // Fetch updated role from backend to ensure we have the latest data
      const updatedRoleResponse = await apiService.auth.getRoleById(selectedRole.id)
      const updatedRole = updatedRoleResponse.data as Role

      // Update selected role with new permissions from backend
      setSelectedRole({
        ...updatedRole,
        _count: selectedRole._count, // Preserve count
      })

      // Update roles list
      setRoles((prev) =>
        prev.map((role) =>
          role.id === selectedRole.id
            ? { ...updatedRole, _count: role._count } // Preserve count
            : role
        )
      )

      // Clear pending permissions
      setPendingPermissions(null)

      toast({
        title: "Success",
        description: "Module access updated successfully",
      })
    } catch (error: any) {
      console.error("Failed to update role permissions:", error)
      
      // Revert pending permissions on error
      setPendingPermissions(originalPermissions)

      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update permissions",
        variant: "destructive",
      })
    } finally {
      setSavingPermissions(false)
    }
  }

  // Save explicit permission changes
  const saveExplicitPermissions = async () => {
    if (!selectedRole || !pendingExplicitPermissions) return

    setSavingPermissions(true)
    const originalPermissions = [...explicitPermissions]

    try {
      // Save to backend using new API
      await apiService.auth.updateRolePermissions(selectedRole.id, pendingExplicitPermissions)

      // Refresh permissions
      await fetchExplicitPermissions()

      // Clear pending permissions
      setPendingExplicitPermissions(null)

      toast({
        title: "Success",
        description: "Permissions updated successfully",
      })
    } catch (error: any) {
      console.error("Failed to update explicit permissions:", error)
      
      // Revert on error
      setExplicitPermissions(originalPermissions)
      setPendingExplicitPermissions(null)

      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update permissions",
        variant: "destructive",
      })
    } finally {
      setSavingPermissions(false)
    }
  }

  // Cancel pending changes
  const cancelPermissions = () => {
    setPendingPermissions(null)
    setPendingExplicitPermissions(null)
  }

  // Fetch explicit permissions for selected role
  const fetchExplicitPermissions = async () => {
    if (!selectedRole) return

    try {
      setLoadingPermissions(true)
      // Fetch role with available permissions structure
      const roleResponse = await apiService.auth.getRoleById(selectedRole.id)
      const roleData = roleResponse.data as any
      
      if (roleData.availablePermissions) {
        setAvailablePermissions(roleData.availablePermissions)
      } else {
        // Fallback: use empty object if not available
        setAvailablePermissions({})
      }

      // Fetch explicit permissions
      try {
        const permissionsResponse = await apiService.auth.getRolePermissions(selectedRole.id)
        setExplicitPermissions(permissionsResponse.data || [])
      } catch (permError: any) {
        // If endpoint doesn't exist or fails, use empty array
        console.warn("Could not fetch explicit permissions:", permError)
        setExplicitPermissions([])
      }
    } catch (error: any) {
      console.error("Failed to fetch role data:", error)
      setAvailablePermissions({})
      setExplicitPermissions([])
    } finally {
      setLoadingPermissions(false)
    }
  }

  // Handle explicit permission changes from matrix
  const handleExplicitPermissionsChange = (permissions: Array<{
    module: string
    submodule?: string
    action: string
    granted: boolean
  }>) => {
    setPendingExplicitPermissions(permissions)
  }

  // Reset pending permissions when role changes
  useEffect(() => {
    if (selectedRole) {
      setPendingPermissions(null)
      setPendingExplicitPermissions(null)
      fetchExplicitPermissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole?.id])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-muted/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Roles</h2>
          {user?.role?.toLowerCase() === "admin" && (
            <Button
              size="sm"
              onClick={() => {
                setCreateRoleData({
                  roleName: "",
                  username: "",
                  email: "",
                  password: "",
                  phoneNumber: "",
                })
                setSelectedDefaultRole(null)
                setShowCreateRoleDialog(true)
              }}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              roles.map((role) => (
                <Card
                  key={role.id}
                  className={`p-3 cursor-pointer transition-all ${
                    selectedRole?.id === role.id
                      ? "bg-primary text-primary-foreground"
                      : role.status === 'DEACTIVATED' 
                        ? "opacity-60 hover:opacity-80"
                        : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedRole(role)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${role.status === 'DEACTIVATED' ? 'line-through' : ''}`}>
                          {role.name}
                        </p>
                        {role.status === 'SYSTEM_LOCKED' && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                            System
                          </Badge>
                        )}
                        {role.status === 'DEACTIVATED' && (
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-300">
                            Deactivated
                          </Badge>
                        )}
                        {(!role.status || role.status === 'ACTIVE') && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs opacity-70">
                        {role._count?.users || 0} users
                      </p>
                    </div>
                    {role.name === "Admin" && (
                      <Shield className="h-4 w-4" />
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="hover:bg-muted"
              title="Go Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {selectedRole?.name || "Roles & Permissions"}
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage role permissions and generate invite links
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {user?.role?.toLowerCase() === "admin" && (
              <Button
                onClick={() => {
                  setCreateRoleData({
                    roleName: "",
                    username: "",
                    email: "",
                    password: "",
                    phoneNumber: "",
                  })
                  setSelectedDefaultRole(null)
                  setShowCreateRoleDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative"
            >
              <Bell className="h-4 w-4 mr-2" />
              Notifications
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
            {selectedRole && user?.role?.toLowerCase() === "admin" && (
              <>
              <Button onClick={() => setShowInviteDialog(true)}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Generate Invite Link
              </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowInspectionPanel(true)}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Inspect Permissions
                </Button>
                {/* PART 1: Deactivate Role button (only for non-system roles) */}
                {selectedRole.status !== 'SYSTEM_LOCKED' && 
                 selectedRole.name?.toLowerCase() !== 'admin' &&
                 selectedRole.status !== 'DEACTIVATED' && (
                  <Button 
                    variant="destructive"
                    onClick={() => setShowDeactivateDialog(true)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Deactivate Role
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {selectedRole ? (
          <div className="space-y-6">
            {/* PART 2: System Role Warning for Admin */}
            {selectedRole.status === 'SYSTEM_LOCKED' || selectedRole.name?.toLowerCase() === 'admin' ? (
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-900 mb-1">System Role - Non-Editable</div>
                    <div className="text-sm text-yellow-800">
                      This role is system-locked and cannot be modified, deactivated, or deleted. 
                      The Admin role maintains full access to ensure system integrity and prevent privilege loss.
                    </div>
                  </div>
                </div>
              </Card>
            ) : selectedRole.status === 'DEACTIVATED' ? (
              <Card className="p-4 bg-gray-50 border-gray-200">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">Deactivated Role - Read Only</div>
                    <div className="text-sm text-gray-700">
                      This role is deactivated. Permissions are frozen and cannot be modified. 
                      The role does not grant permissions at runtime.
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            {/* Module Access Toggles */}
            <Card className={`p-6 ${(selectedRole.status === 'DEACTIVATED' || selectedRole.status === 'SYSTEM_LOCKED') ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Module Access
                    {(selectedRole.status === 'DEACTIVATED' || selectedRole.status === 'SYSTEM_LOCKED') && (
                      <span className="ml-2 text-sm text-muted-foreground">(Read Only)</span>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Toggle access to different modules for this role
                  </p>
                </div>
                {pendingPermissions !== null && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelPermissions}
                      disabled={savingPermissions}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={savePermissions}
                      disabled={savingPermissions}
                    >
                      {savingPermissions ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {selectedRole.name?.toLowerCase() !== "admin" && 
                 user?.role?.toLowerCase() === "admin" ? (
                  <>
                    {/* Properties Module */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-foreground">Properties</h3>
                          <p className="text-sm text-muted-foreground">
                            Access to properties management
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hasModuleAccess(selectedRole.permissions, "properties")}
                        onCheckedChange={(checked) =>
                          toggleModuleAccess("properties", checked)
                        }
                      />
                    </div>

                    {/* HR Management Module */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-foreground">HR Management</h3>
                          <p className="text-sm text-muted-foreground">
                            Access to HR and employee management
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hasModuleAccess(selectedRole.permissions, "hr")}
                        onCheckedChange={(checked) =>
                          toggleModuleAccess("hr", checked)
                        }
                      />
                    </div>

                    {/* CRM Module */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <UserCircle className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-foreground">CRM</h3>
                          <p className="text-sm text-muted-foreground">
                            Access to customer relationship management
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hasModuleAccess(selectedRole.permissions, "crm")}
                        onCheckedChange={(checked) =>
                          toggleModuleAccess("crm", checked)
                        }
                      />
                    </div>

                    {/* Finance Module */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-foreground">Finance</h3>
                          <p className="text-sm text-muted-foreground">
                            Access to financial management
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hasModuleAccess(selectedRole.permissions, "finance")}
                        onCheckedChange={(checked) =>
                          toggleModuleAccess("finance", checked)
                        }
                      />
                    </div>

                    {/* Tenant Portal Module */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Home className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-foreground">Tenant Portal</h3>
                          <p className="text-sm text-muted-foreground">
                            Access to tenant portal and management
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hasModuleAccess(selectedRole.permissions, "tenant")}
                        onCheckedChange={(checked) =>
                          toggleModuleAccess("tenant", checked)
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-4 border border-border rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      {selectedRole.name === "Admin"
                        ? "Admin role has full access to all modules"
                        : "Only admin can modify role permissions"}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Detailed Permissions - Permission Matrix */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                Detailed Permissions
              </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage granular permissions for modules and submodules
                  </p>
              </div>
                {pendingExplicitPermissions !== null && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelPermissions}
                      disabled={savingPermissions}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveExplicitPermissions}
                      disabled={savingPermissions}
                    >
                      {savingPermissions ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                )}
              </div>
              
              {selectedRole.name?.toLowerCase() === "admin" ? (
                <div className="p-4 border border-border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Admin role has full access to all modules and actions
                  </p>
                </div>
              ) : user?.role?.toLowerCase() === "admin" ? (
                <PermissionMatrix
                  roleId={selectedRole.id}
                  roleName={selectedRole.name}
                  permissions={pendingExplicitPermissions 
                    ? pendingExplicitPermissions.map((p, idx) => ({
                        id: `pending-${idx}`,
                        roleId: selectedRole.id,
                        module: p.module,
                        submodule: p.submodule || null,
                        action: p.action,
                        granted: p.granted,
                        createdAt: new Date().toISOString(),
                        createdBy: null,
                      }))
                    : explicitPermissions}
                  availablePermissions={availablePermissions}
                  loading={loadingPermissions}
                  onPermissionsChange={handleExplicitPermissionsChange}
                  readOnly={false}
                />
              ) : (
                <div className="p-4 border border-border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Only admin can view and modify detailed permissions
                  </p>
                </div>
              )}
            </Card>

            {/* Users with this Role */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Users with this Role
              </h2>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : roleUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No users assigned to this role yet
                </p>
              ) : (
                <div className="space-y-3">
                  {roleUsers.map((roleUser) => (
                    <div
                      key={roleUser.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {roleUser.username || "N/A"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {roleUser.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined: {new Date(roleUser.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Role Information
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Users:</span>
                  <span className="font-medium">{selectedRole._count?.users || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invite Links:</span>
                  <span className="font-medium">
                    {selectedRole._count?.inviteLinks || 0}
                  </span>
                </div>
                {user?.role?.toLowerCase() === "admin" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Default Password:</span>
                    <span className="font-medium">
                      {selectedRole.defaultPassword ? "Set" : "Not Set"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {new Date(selectedRole.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Select a role to view details</p>
          </Card>
        )}
      </div>

      {/* Role Selection Dialog */}
      <Dialog open={showRoleSelectionDialog} onOpenChange={setShowRoleSelectionDialog}>
        <DialogContent className="w-[800px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Create Role or Generate Invite</DialogTitle>
            <DialogDescription>
              Select a default role to generate invite link or create a custom role
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Tenant */}
            <Card
              className="p-6 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => handleRoleSelection("Tenant")}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <UserCircle className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground">Tenant</h3>
                <p className="text-xs text-muted-foreground">
                  Generate invite link for Tenant role
                </p>
              </div>
            </Card>

            {/* Dealer */}
            <Card
              className="p-6 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => handleRoleSelection("Dealer")}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <UserCircle className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground">Dealer</h3>
                <p className="text-xs text-muted-foreground">
                  Generate invite link for Dealer role
                </p>
              </div>
            </Card>

            {/* HR Manager */}
            <Card
              className="p-6 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => handleRoleSelection("HR Manager")}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <Users className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground">HR Manager</h3>
                <p className="text-xs text-muted-foreground">
                  Generate invite link for HR Manager role
                </p>
              </div>
            </Card>

            {/* Accountant */}
            <Card
              className="p-6 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => handleRoleSelection("Accountant")}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <DollarSign className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground">Accountant</h3>
                <p className="text-xs text-muted-foreground">
                  Generate invite link for Accountant role
                </p>
              </div>
            </Card>

            {/* Custom Role */}
            <Card
              className="p-6 cursor-pointer hover:bg-muted transition-colors col-span-2"
              onClick={handleCustomRole}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <Plus className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground">Custom Role</h3>
                <p className="text-xs text-muted-foreground">
                  Create a new role with custom permissions
                </p>
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleSelectionDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={showCreateRoleDialog} onOpenChange={setShowCreateRoleDialog}>
        <DialogContent className="w-[800px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Role & User</DialogTitle>
            <DialogDescription>
              Select a default role or create a custom role with user account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Default Role Selection */}
            <div className="space-y-2">
              <Label>Select Default Role</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Admin - Full Access */}
                <Card
                  className={`p-4 cursor-pointer transition-all border-2 col-span-2 ${
                    selectedDefaultRole === "Admin"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => handleSelectDefaultRole("Admin")}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <Shield className="h-6 w-6 text-red-500" />
                    <h3 className="font-semibold text-sm text-foreground">Admin</h3>
                    <p className="text-xs text-muted-foreground">Full access to all modules</p>
                  </div>
                </Card>

                <Card
                  className={`p-4 cursor-pointer transition-all border-2 ${
                    selectedDefaultRole === "Dealer"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => handleSelectDefaultRole("Dealer")}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <UserCircle className="h-6 w-6 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">Dealer</h3>
                  </div>
                </Card>

                <Card
                  className={`p-4 cursor-pointer transition-all border-2 ${
                    selectedDefaultRole === "Tenant"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => handleSelectDefaultRole("Tenant")}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <UserCircle className="h-6 w-6 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">Tenant</h3>
                  </div>
                </Card>

                <Card
                  className={`p-4 cursor-pointer transition-all border-2 ${
                    selectedDefaultRole === "HR Manager"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => handleSelectDefaultRole("HR Manager")}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <Users className="h-6 w-6 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">HR Manager</h3>
                  </div>
                </Card>

                <Card
                  className={`p-4 cursor-pointer transition-all border-2 ${
                    selectedDefaultRole === "Accountant"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => handleSelectDefaultRole("Accountant")}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <DollarSign className="h-6 w-6 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">Accountant</h3>
                  </div>
                </Card>
              </div>
            </div>

            <Separator />

            {/* Custom Role Name */}
            <div className="space-y-2">
              <Label htmlFor="roleName">Custom Role Name (Optional)</Label>
              <Input
                id="roleName"
                value={selectedDefaultRole ? "" : createRoleData.roleName}
                onChange={(e) => {
                  setSelectedDefaultRole(null)
                  setCreateRoleData({ ...createRoleData, roleName: e.target.value })
                }}
                placeholder="e.g., Property Manager"
                disabled={!!selectedDefaultRole}
              />
              {selectedDefaultRole && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium">{selectedDefaultRole}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={createRoleData.username}
                onChange={(e) =>
                  setCreateRoleData({ ...createRoleData, username: e.target.value })
                }
                placeholder="johndoe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={createRoleData.email}
                onChange={(e) =>
                  setCreateRoleData({ ...createRoleData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={createRoleData.phoneNumber}
                onChange={(e) =>
                  setCreateRoleData({ ...createRoleData, phoneNumber: e.target.value })
                }
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={createRoleData.password}
                onChange={(e) =>
                  setCreateRoleData({ ...createRoleData, password: e.target.value })
                }
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole}>Create Role & User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invite Link Dialog */}
      <Dialog 
        open={showInviteDialog} 
        onOpenChange={(open: boolean) => {
          setShowInviteDialog(open)
          if (!open) {
            // Reset state when dialog closes
        setInviteData({
          roleId: "",
          username: "",
          email: "",
          message: "",
        })
            setSelectedInviteUser(null)
            setInviteRoleUsers([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invite Link</DialogTitle>
            <DialogDescription>
              Create an invite link for a user to join with this role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <select
                id="inviteRole"
                value={inviteData.roleId}
                onChange={(e) => handleInviteRoleChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Show users with selected role */}
            {inviteData.roleId && (
              <div className="space-y-2">
                <Label>Existing Users with this Role</Label>
                {loadingInviteUsers ? (
                  <div className="flex items-center justify-center py-4 border rounded-md">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : inviteRoleUsers.length > 0 ? (
                  <ScrollArea className="h-32 border rounded-md p-2">
                    <div className="space-y-2">
                      {inviteRoleUsers.map((user) => (
                        <Card
                          key={user.id}
                          className={`p-3 cursor-pointer transition-all border ${
                            selectedInviteUser?.id === user.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted"
                          }`}
                          onClick={() => handleSelectInviteUser(user)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm text-foreground">
                                {user.username}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                            {selectedInviteUser?.id === user.id && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                    No users found with this role
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="inviteUsername">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inviteUsername"
                value={inviteData.username}
                onChange={(e) =>
                  setInviteData({ ...inviteData, username: e.target.value })
                }
                placeholder="johndoe"
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteData.email}
                onChange={(e) =>
                  setInviteData({ ...inviteData, email: e.target.value })
                }
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteMessage">Message (Optional)</Label>
              <Textarea
                id="inviteMessage"
                value={inviteData.message}
                onChange={(e) =>
                  setInviteData({ ...inviteData, message: e.target.value })
                }
                placeholder="Welcome message for the user"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log("Button clicked, calling handleGenerateInviteLink")
                handleGenerateInviteLink()
              }}
              disabled={generatingInvite}
            >
              {generatingInvite ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Link"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Invite Link Dialog */}
      <Dialog open={showInviteLinkDialog} onOpenChange={setShowInviteLinkDialog}>
        <DialogContent className="w-[800px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Invite Link Generated</DialogTitle>
            <DialogDescription>
              Share this link with the user to invite them to join
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedInviteLink || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyInviteLink}
                  title="Copy link"
                >
                  {copiedToken === generatedInviteLink ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> This link will expire in 7 days. Make sure to share it with the user promptly.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteLinkDialog(false)}>
              Close
            </Button>
            <Button onClick={copyInviteLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed right-4 top-20 w-96 bg-background border border-border rounded-lg shadow-lg z-50 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotifications(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No notifications
                </p>
              ) : (
                <>
                  {notifications.slice(0, 5).map((notification) => (
                    <Card
                      key={notification.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        !notification.read ? "bg-primary/10 border-primary" : ""
                      }`}
                      onClick={async () => {
                        // Mark notification as read when clicked
                        if (!notification.read) {
                          try {
                            await apiService.auth.markNotificationRead(notification.id)
                            // Update local state
                            setNotifications((prev) =>
                              prev.map((n) =>
                                n.id === notification.id ? { ...n, read: true } : n
                              )
                            )
                          } catch (error) {
                            console.error("Failed to mark notification as read:", error)
                          }
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(notification.createdAt).toLocaleString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {notifications.length > 5 && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          router.push("/notifications")
                        }}
                      >
                        View More ({notifications.length - 5} more)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Permission Inspection Panel */}
      {selectedRole && (
        <PermissionInspectionPanel
          open={showInspectionPanel}
          onOpenChange={setShowInspectionPanel}
          type="role"
          id={selectedRole.id}
          name={selectedRole.name}
        />
      )}

      {/* PART 1: Deactivation Warning Modal */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Deactivate Role: {selectedRole?.name}
            </DialogTitle>
            <DialogDescription>
              This action is irreversible. The role will be deactivated but not deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* User Impact Summary */}
            {selectedRole && (selectedRole._count?.users || 0) > 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-900 mb-2">User Impact</div>
                    <div className="text-sm text-yellow-800 space-y-1">
                      <p>This role has <strong>{selectedRole._count?.users || 0} active user(s)</strong> assigned to it.</p>
                      <p className="mt-2 font-medium">All users must be reassigned to another role before deactivation can proceed.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-blue-900 mb-1">No Active Users</div>
                    <div className="text-sm text-blue-800">
                      This role has no active users assigned. Deactivation will proceed immediately.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Notice */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Audit Notice</div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>• This action will be logged in the audit trail</p>
                    <p>• Role permissions will be frozen at the time of deactivation</p>
                    <p>• Deactivated roles will not grant permissions at runtime</p>
                    <p>• Role history and audit logs will be preserved</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Required Reassignment Warning */}
            {(selectedRole?._count?.users || 0) > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-red-900 mb-1">Reassignment Required</div>
                    <div className="text-sm text-red-800 mb-3">
                      All {selectedRole?._count?.users || 0} user(s) must be reassigned to another active role before this role can be deactivated.
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-red-700 font-medium">
                        To reassign users, use the User Reassignment API endpoint:
                      </p>
                      <code className="block text-xs bg-red-50 p-2 rounded border border-red-200 text-red-800">
                        POST /api/users/:userId/roles/reassign
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!selectedRole) return
                          
                          // PART 1: Close modal and navigate with context
                          setShowDeactivateDialog(false)
                          
                          // Navigate with query params and state
                          const queryParams = new URLSearchParams({
                            role: selectedRole.id,
                            status: 'active',
                            context: 'ROLE_DEACTIVATION',
                            sourceRoleId: selectedRole.id,
                            sourceRoleName: selectedRole.name,
                            returnTo: `/roles`
                          })
                          
                          router.push(`/users?${queryParams.toString()}`)
                        }}
                        className="w-full"
                      >
                        Close & View Users List
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeactivateDialog(false)}
              disabled={deactivatingRole}
            >
              Cancel
            </Button>
            {/* PART 5: Block Deactivation UI - Disable confirm button until activeUsersCount === 0 */}
            {(selectedRole?._count?.users || 0) === 0 ? (
              <Button
                variant="destructive"
                onClick={handleDeactivateRole}
                disabled={deactivatingRole}
              >
                {deactivatingRole ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Confirm Deactivation
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={true}
                className="opacity-50 cursor-not-allowed"
              >
                Cannot Deactivate (Users Assigned)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


