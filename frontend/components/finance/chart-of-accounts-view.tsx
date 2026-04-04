"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  Search, 
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Plus,
  Pencil,
  Trash2,
  BarChart3
} from "lucide-react"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddAccountDialog } from "./add-account-dialog"
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

interface Account {
  id: string
  code: string
  name: string
  type: string
  description?: string
  isActive: boolean
  isPostable: boolean
  level: number
  accountType: string
  normalBalance: string
  trustFlag: boolean
  cashFlowCategory?: string
  parentId?: string
  parent?: Account
  children?: Account[]
  balance?: number
  debitTotal?: number
  creditTotal?: number
  createdAt?: string
  updatedAt?: string
  _count?: {
    debitLedgerEntries?: number
    creditLedgerEntries?: number
    journalLines?: number
  }
}

// Color mapping for account types
const getAccountTypeColor = (type: string): string => {
  switch (type) {
    case 'Asset':
      return 'bg-blue-500' // 🔵 Blue
    case 'Liability':
      return 'bg-yellow-500' // 🟡 Yellow
    case 'Equity':
      return 'bg-green-500' // 🟢 Green
    case 'Revenue':
      return 'bg-emerald-600' // 🟩 Dark Green
    case 'Expense':
      return 'bg-red-500' // 🔴 Red
    default:
      return 'bg-gray-500'
  }
}

const getAccountTypeBorderColor = (type: string): string => {
  switch (type) {
    case 'Asset':
      return 'border-l-blue-500'
    case 'Liability':
      return 'border-l-yellow-500'
    case 'Equity':
      return 'border-l-green-500'
    case 'Revenue':
      return 'border-l-emerald-600'
    case 'Expense':
      return 'border-l-red-500'
    default:
      return 'border-l-gray-500'
  }
}

export function ChartOfAccountsView() {
  const { toast } = useToast()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedAccountDetails, setSelectedAccountDetails] = useState<Account | null>(null)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.accounts.getAll({ tree: 'true' })
      const responseData = response?.data as any
      const accountsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setAccounts(accountsData)
      
      // Auto-expand all parent accounts by default
      const expandAllParents = (accs: Account[]): Set<string> => {
        const expanded = new Set<string>()
        const traverse = (items: Account[]) => {
          items.forEach(acc => {
            if (acc.children && acc.children.length > 0) {
              expanded.add(acc.id)
              traverse(acc.children)
            }
          })
        }
        traverse(accs)
        return expanded
      }
      setExpandedAccounts(expandAllParents(accountsData))
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Failed to fetch accounts",
        variant: "destructive",
      })
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAccountDetails = async (accountId: string) => {
    try {
      const response: any = await apiService.accounts.getById(accountId)
      const responseData = response?.data as any
      const accountData = responseData?.data || responseData
      setSelectedAccountDetails(accountData)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Failed to fetch account details",
        variant: "destructive",
      })
    }
  }

  const toggleExpand = useCallback((accountId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedAccounts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(accountId)) {
        newSet.delete(accountId)
      } else {
        newSet.add(accountId)
      }
      return newSet
    })
  }, [])

  const handleAccountClick = useCallback(async (account: Account) => {
    setSelectedAccount(account)
    await fetchAccountDetails(account.id)
  }, [])

  const handleAddAccount = () => {
    setAccountToEdit(null)
    setIsAccountDialogOpen(true)
  }

  const handleEditAccount = (account: Account) => {
    setAccountToEdit(account)
    setIsAccountDialogOpen(true)
  }

  const handleDeleteClick = (account: Account) => {
    setAccountToDelete(account)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!accountToDelete) return

    try {
      await apiService.accounts.delete(accountToDelete.id)
      toast({ title: "Account deleted successfully" })
      fetchAccounts()
      if (selectedAccount?.id === accountToDelete.id) {
        setSelectedAccount(null)
        setSelectedAccountDetails(null)
      }
    } catch (error: any) {
      toast({
        title: "Failed to delete account",
        description: error?.response?.data?.error || error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsDeleteDialogOpen(false)
      setAccountToDelete(null)
    }
  }

  // Filter accounts by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts

    const filterTree = (items: Account[]): Account[] => {
      const result: Account[] = []
      
      for (const item of items) {
        const matches = 
          item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        
        const filteredChildren = item.children ? filterTree(item.children) : []
        
        if (matches || filteredChildren.length > 0) {
          result.push({
            ...item,
            children: filteredChildren.length > 0 ? filteredChildren : item.children
          })
        }
      }
      
      return result
    }

    return filterTree(accounts)
  }, [accounts, searchQuery])

  const renderTreeItem = (account: Account, level: number = 0): JSX.Element => {
    const isExpanded = expandedAccounts.has(account.id)
    const hasChildren = account.children && account.children.length > 0
    const isSelected = selectedAccount?.id === account.id
    const indent = level * 24
    const accountColor = getAccountTypeColor(account.type)
    const borderColor = getAccountTypeBorderColor(account.type)

    return (
      <div key={account.id}>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border-l-4",
            borderColor,
            isSelected && "bg-muted border-l-4 font-medium"
          )}
          style={{ paddingLeft: `${12 + indent}px` }}
          onClick={() => handleAccountClick(account)}
        >
          {/* Expand/Collapse Button */}
          <div className="flex items-center gap-1 min-w-[24px]">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0"
                onClick={(e) => toggleExpand(account.id, e)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
          </div>

          {/* Icon */}
          <div className={cn("h-4 w-4 rounded flex-shrink-0", accountColor)} />
          
          {/* Account Code */}
          <span className="font-mono text-sm font-medium text-foreground min-w-[100px]">
            {account.code}
          </span>

          {/* Account Name */}
          <span className="text-sm text-foreground flex-1 truncate">
            {account.name}
          </span>

          {/* Account Type Icon */}
          <div className="flex-shrink-0">
            {account.accountType === 'Header' || account.accountType === 'Control' ? (
              <Folder className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {account.children!.map((child) => renderTreeItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null) return "Rs 0.00"
    return `Rs ${Math.abs(amount).toLocaleString("en-IN", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`
  }

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "—"
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric"
      })
    } catch {
      return "—"
    }
  }

  const transactionCount = useMemo(() => {
    if (!selectedAccountDetails?._count) return 0
    return (selectedAccountDetails._count.debitLedgerEntries || 0) + 
           (selectedAccountDetails._count.creditLedgerEntries || 0) +
           (selectedAccountDetails._count.journalLines || 0)
  }, [selectedAccountDetails])

  return (
    <>
      <div className="h-[calc(100vh-250px)] md:h-[calc(100vh-200px)] flex flex-col overflow-hidden">
        {/* Search Bar & Actions */}
        <div className="mb-4 px-1 flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
              const params = new URLSearchParams()
              params.set('tab', 'reports')
              router.push(`/finance?${params.toString()}`)
            }}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Financial Reports
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleAddAccount}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
        </div>

        {/* Main Content: Split Layout */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
        {/* LEFT SECTION - Account Tree */}
        <Card className="flex-1 flex flex-col overflow-hidden border-r md:border-r-0 md:border-b min-w-0">
          <CardHeader className="flex-shrink-0 pb-3 border-b">
            <CardTitle className="text-lg">Account Tree</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No accounts found
                </div>
              ) : (
                <div className="py-2">
                  {filteredAccounts.map((account) => renderTreeItem(account))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* RIGHT SECTION - Account Detail Panel */}
        <Card className="w-full md:w-[500px] flex flex-col overflow-hidden flex-shrink-0 md:min-w-[500px]">
          <CardHeader 
            className={cn(
              "flex-shrink-0 pb-3 border-b",
              selectedAccount && getAccountTypeBorderColor(selectedAccount.type)
            )}
            style={{
              borderLeftWidth: selectedAccount ? '4px' : '0px'
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-lg">Account Details</CardTitle>
              {selectedAccount && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditAccount(selectedAccount)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(selectedAccount)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
            <ScrollArea className="h-full">
              {!selectedAccountDetails ? (
                <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Select an account to view details</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Header Row */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-lg font-bold text-foreground">
                            {selectedAccountDetails.code}
                          </span>
                          <Badge 
                            variant={selectedAccountDetails.accountType === 'Posting' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {selectedAccountDetails.accountType}
                          </Badge>
                          <Badge 
                            variant={selectedAccountDetails.isActive ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {selectedAccountDetails.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground">
                          {selectedAccountDetails.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Parent Account</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedAccountDetails.parent?.name || 'Root Account'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Account Nature</p>
                      <Badge variant="outline" className="text-xs">
                        {selectedAccountDetails.type}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Normal Balance</p>
                      <Badge 
                        variant={selectedAccountDetails.normalBalance === 'Debit' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {selectedAccountDetails.normalBalance}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Posting Allowed</p>
                      <div className="flex items-center gap-2">
                        {selectedAccountDetails.isPostable ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-foreground">Yes</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-foreground">No</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Trust Account</p>
                        <div className="flex items-center gap-2">
                        {selectedAccountDetails.trustFlag ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-foreground">Yes</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">No</span>
                          </>
                        )}
                      </div>
                    </div>
                    {selectedAccountDetails.balance !== undefined && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Balance</p>
                        <p className={cn(
                          "text-sm font-semibold",
                          selectedAccountDetails.balance >= 0 ? "text-foreground" : "text-red-500"
                        )}>
                          {formatCurrency(selectedAccountDetails.balance)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Description Box */}
                  {selectedAccountDetails.description && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Description</p>
                      <div className="p-3 bg-muted/50 rounded-md border">
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {selectedAccountDetails.description}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Balance Details */}
                  {(selectedAccountDetails.debitTotal !== undefined || selectedAccountDetails.creditTotal !== undefined) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Transaction Totals</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/50 rounded-md border">
                          <p className="text-xs text-muted-foreground mb-1">Total Debits</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(selectedAccountDetails.debitTotal)}
                          </p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-md border">
                          <p className="text-xs text-muted-foreground mb-1">Total Credits</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(selectedAccountDetails.creditTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meta Section */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Created: {formatDate(selectedAccountDetails.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Updated: {formatDate(selectedAccountDetails.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>Used In: {transactionCount} transaction(s)</span>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        </div>
      </div>

      <AddAccountDialog 
        open={isAccountDialogOpen} 
        accountToEdit={accountToEdit}
        onOpenChange={(open) => {
          setIsAccountDialogOpen(open)
          if (!open) {
            setAccountToEdit(null)
            // Refresh accounts when dialog closes
            fetchAccounts()
            if (selectedAccount) {
              fetchAccountDetails(selectedAccount.id)
            }
          }
        }}
        onSuccess={() => {
          fetchAccounts()
          if (selectedAccount) {
            fetchAccountDetails(selectedAccount.id)
          }
        }}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the account
              <span className="font-medium text-foreground"> {accountToDelete?.code} - {accountToDelete?.name}</span>.
              {accountToDelete && (accountToDelete.children?.length ?? 0) > 0 && (
                <div className="mt-2 text-red-500 font-medium">
                  Warning: This account has child accounts. You cannot delete it until all children are removed.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!accountToDelete?.children?.length}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
