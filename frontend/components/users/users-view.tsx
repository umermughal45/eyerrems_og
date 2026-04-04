"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Loader2, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface User {
  id: string
  username: string
  email: string
  roleId: string
  role: {
    id: string
    name: string
    status: string
  } | null
  createdAt: string
}

type PageContext = 'NORMAL' | 'ROLE_DEACTIVATION'

export function UsersView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [users, setUsers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([]) // Store all users for filtering
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [pageContext, setPageContext] = useState<PageContext>('NORMAL')
  const [sourceRoleId, setSourceRoleId] = useState<string | null>(null)
  const [sourceRoleName, setSourceRoleName] = useState<string | null>(null)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [showExitWarning, setShowExitWarning] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [targetRoleId, setTargetRoleId] = useState<string>("")
  const [availableRoles, setAvailableRoles] = useState<any[]>([])
  const [reassigning, setReassigning] = useState(false)

  // PART 2: Detect Context on page load
  useEffect(() => {
    const context = searchParams.get('context')
    const roleId = searchParams.get('sourceRoleId')
    const roleName = searchParams.get('sourceRoleName')
    const returnPath = searchParams.get('returnTo')

    if (context === 'ROLE_DEACTIVATION' && roleId && roleName) {
      setPageContext('ROLE_DEACTIVATION')
      setSourceRoleId(roleId)
      setSourceRoleName(roleName)
      setReturnTo(returnPath || '/roles')
    } else {
      setPageContext('NORMAL')
      setSourceRoleId(null)
      setSourceRoleName(null)
      setReturnTo(null)
    }
  }, [searchParams])

  // Fetch users
  useEffect(() => {
    fetchUsers()
    if (pageContext === 'ROLE_DEACTIVATION') {
      fetchRoles()
    }
  }, [pageContext, sourceRoleId])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const roleFilter = sourceRoleId || searchParams.get('role') || undefined
      const statusFilter = searchParams.get('status') || undefined
      
      const response = await apiService.auth.getUsers(roleFilter, statusFilter)
      const usersData = (response.data as User[]) || []
      setAllUsers(usersData)
      
      // Apply enforced filters for ROLE_DEACTIVATION context
      if (pageContext === 'ROLE_DEACTIVATION' && sourceRoleId) {
        const filtered = usersData.filter(user => 
          user.roleId === sourceRoleId && 
          user.role?.status === 'ACTIVE'
        )
        setUsers(filtered)
      } else {
        setUsers(usersData)
      }
    } catch (error: any) {
      console.error("Failed to fetch users:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to fetch users",
        variant: "destructive",
      })
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await apiService.auth.getRoles()
      const rolesData = (response.data as any[]) || []
      // Filter to only ACTIVE roles (excluding the source role)
      const activeRoles = rolesData.filter((role: any) => 
        role.status === 'ACTIVE' && 
        role.id !== sourceRoleId &&
        (role.status !== 'SYSTEM_LOCKED' || role.name?.toLowerCase() === 'admin')
      )
      setAvailableRoles(activeRoles)
    } catch (error: any) {
      console.error("Failed to fetch roles:", error)
      setAvailableRoles([])
    }
  }

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    
    const query = searchQuery.toLowerCase()
    return users.filter(user => 
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role?.name.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

  // Calculate remaining users count
  const remainingUsersCount = useMemo(() => {
    if (pageContext !== 'ROLE_DEACTIVATION') return 0
    return filteredUsers.length
  }, [pageContext, filteredUsers.length])

  // Handle user reassignment
  const handleReassign = async () => {
    if (!editingUser || !targetRoleId || !sourceRoleId) return

    // Validation
    if (targetRoleId === sourceRoleId) {
      toast({
        title: "Invalid Reassignment",
        description: "Target role must be different from source role",
        variant: "destructive",
      })
      return
    }

    const targetRole = availableRoles.find(r => r.id === targetRoleId)
    if (!targetRole) {
      toast({
        title: "Invalid Role",
        description: "Selected role not found",
        variant: "destructive",
      })
      return
    }

    if (targetRole.status !== 'ACTIVE') {
      toast({
        title: "Invalid Role",
        description: "Target role must be ACTIVE",
        variant: "destructive",
      })
      return
    }

    try {
      setReassigning(true)
      await apiService.auth.reassignUserRole(editingUser.id, {
        fromRoleId: sourceRoleId,
        toRoleId: targetRoleId,
        reason: 'ROLE_DEACTIVATION_PREP',
      })

      toast({
        title: "Success",
        description: `User ${editingUser.username} reassigned to ${targetRole.name}`,
      })

      // Refresh users list
      await fetchUsers()
      setEditingUser(null)
      setTargetRoleId("")
    } catch (error: any) {
      console.error("Failed to reassign user:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || error.response?.data?.message || "Failed to reassign user",
        variant: "destructive",
      })
    } finally {
      setReassigning(false)
    }
  }

  // PART 5: Prevent navigation away when in ROLE_DEACTIVATION context
  useEffect(() => {
    if (pageContext !== 'ROLE_DEACTIVATION' || remainingUsersCount === 0) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Role deactivation is incomplete. Users are still assigned.'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [pageContext, remainingUsersCount])

  // Handle return to role deactivation
  const handleReturnToDeactivation = () => {
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.push('/roles')
    }
  }

  return (
    <div className="space-y-6">
      {/* PART 2: Context Banner (Mandatory) */}
      {pageContext === 'ROLE_DEACTIVATION' && sourceRoleName && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            {remainingUsersCount === 0 ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-green-900 mb-1">
                    ✅ All users reassigned. You may now deactivate the role.
                  </div>
                  <div className="text-sm text-green-800 mb-3">
                    All users from role "{sourceRoleName}" have been successfully reassigned.
                  </div>
                  <Button
                    onClick={handleReturnToDeactivation}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to Role Deactivation
                  </Button>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-yellow-900 mb-1">
                    ⚠ Preparing to deactivate role "{sourceRoleName}"
                  </div>
                  <div className="text-sm text-yellow-800">
                    All listed users must be reassigned before deactivation can proceed.
                    {remainingUsersCount > 0 && (
                      <span className="font-medium ml-1">
                        ({remainingUsersCount} user{remainingUsersCount !== 1 ? 's' : ''} remaining)
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">User Management</h1>
        {pageContext === 'NORMAL' && (
          <Button
            variant="outline"
            onClick={() => router.push('/roles')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Roles
          </Button>
        )}
        {pageContext === 'ROLE_DEACTIVATION' && remainingUsersCount > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              setPendingNavigation('/roles')
              setShowExitWarning(true)
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit Deactivation Mode
          </Button>
        )}
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by username, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {pageContext === 'ROLE_DEACTIVATION' && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                Role Deactivation Mode
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                Filters Locked
              </Badge>
            </div>
          )}
        </div>
        {pageContext === 'ROLE_DEACTIVATION' && sourceRoleName && (
          <div className="mt-2 text-xs text-muted-foreground">
            Showing only users with role "{sourceRoleName}" (ACTIVE status). Filters cannot be removed until all users are reassigned.
          </div>
        )}
      </Card>

      {/* Users Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {pageContext === 'ROLE_DEACTIVATION' 
                ? "No users found for this role." 
                : "No users found."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {pageContext === 'ROLE_DEACTIVATION' && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className={pageContext === 'ROLE_DEACTIVATION' && user.roleId === sourceRoleId ? 'bg-yellow-50' : ''}
                >
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.roleId === sourceRoleId ? "destructive" : "outline"}
                      className={user.roleId === sourceRoleId ? "bg-red-100 text-red-800 border-red-300" : ""}
                    >
                      {user.role?.name || "N/A"}
                      {user.roleId === sourceRoleId && pageContext === 'ROLE_DEACTIVATION' && (
                        <span className="ml-1 text-xs">(Must reassign)</span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.role?.status === 'ACTIVE' ? "default" : "secondary"}
                    >
                      {user.role?.status || 'ACTIVE'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  {pageContext === 'ROLE_DEACTIVATION' && (
                    <TableCell>
                      {user.roleId === sourceRoleId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingUser(user)
                            setTargetRoleId("")
                          }}
                        >
                          Reassign
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Reassignment Dialog */}
      {editingUser && (
        <AlertDialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reassign User</AlertDialogTitle>
              <AlertDialogDescription>
                Reassign {editingUser.username} to another ACTIVE role. This action is required before deactivating the role "{sourceRoleName}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Current Role</label>
                <p className="text-sm text-muted-foreground">{editingUser.role?.name || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Target Role *</label>
                <select
                  value={targetRoleId}
                  onChange={(e) => setTargetRoleId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background"
                  disabled={reassigning}
                >
                  <option value="">Select a role...</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({role.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only ACTIVE roles are available for reassignment.
                </p>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reassigning}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReassign}
                disabled={!targetRoleId || reassigning || targetRoleId === sourceRoleId}
              >
                {reassigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reassigning...
                  </>
                ) : (
                  "Reassign"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Exit Warning Dialog */}
      <AlertDialog open={showExitWarning} onOpenChange={setShowExitWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Role Deactivation Incomplete</AlertDialogTitle>
            <AlertDialogDescription>
              Role deactivation is incomplete. {remainingUsersCount} user{remainingUsersCount !== 1 ? 's are' : ' is'} still assigned to role "{sourceRoleName}".
              <br /><br />
              Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowExitWarning(false)
              setPendingNavigation(null)
            }}>
              Stay on Page
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingNavigation) {
                  router.push(pendingNavigation)
                }
                setShowExitWarning(false)
                setPendingNavigation(null)
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
