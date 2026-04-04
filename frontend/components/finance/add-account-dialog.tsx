"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertCircle, CheckCircle2, Info, ChevronDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

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
}

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountToEdit?: Account | null
  onSuccess?: () => void
}

// Account type compatibility matrix
const ACCOUNT_TYPE_COMPATIBILITY: Record<string, string[]> = {
  Asset: ['Asset'],
  Liability: ['Liability'],
  Equity: ['Equity'],
  Revenue: ['Revenue'],
  Expense: ['Expense'],
}

// Normal balance rules
const NORMAL_BALANCE_RULES: Record<string, 'Debit' | 'Credit'> = {
  Asset: 'Debit',
  Liability: 'Credit',
  Equity: 'Credit',
  Revenue: 'Credit',
  Expense: 'Debit',
}

export function AddAccountDialog({ open, onOpenChange, accountToEdit, onSuccess }: AddAccountDialogProps) {
  const isEditMode = !!accountToEdit
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "Asset" as "Asset" | "Liability" | "Equity" | "Revenue" | "Expense",
    description: "",
    parentId: "",
    accountType: "Posting" as "Header" | "Control" | "Posting",
    normalBalance: "Debit" as "Debit" | "Credit",
    trustFlag: false,
    cashFlowCategory: "" as "" | "Operating" | "Investing" | "Financing" | "Escrow",
  })

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [parentSearchOpen, setParentSearchOpen] = useState(false)
  const [parentSearchQuery, setParentSearchQuery] = useState("")

  // Calculate level based on parent
  const calculatedLevel = useMemo(() => {
    if (!formData.parentId) return 1
    const parent = accounts.find(acc => acc.id === formData.parentId)
    return parent ? parent.level + 1 : 1
  }, [formData.parentId, accounts])

  // Determine if account is postable (only Level 5 Posting accounts)
  const isPostable = useMemo(() => {
    return calculatedLevel === 5 && formData.accountType === "Posting"
  }, [calculatedLevel, formData.accountType])

  // Get valid parent accounts (must be same type, not the account being edited, and not a descendant)
  const validParentAccounts = useMemo(() => {
    return accounts.filter(acc => {
      // Must match account type
      if (acc.type !== formData.type) return false
      
      // Cannot be the account being edited
      if (isEditMode && acc.id === accountToEdit?.id) return false
      
      // Cannot be a descendant of the account being edited
      if (isEditMode && accountToEdit) {
        const isDescendant = (account: Account, targetId: string): boolean => {
          if (account.id === targetId) return true
          if (account.children) {
            return account.children.some(child => isDescendant(child, targetId))
          }
          return false
        }
        if (isDescendant(acc, accountToEdit.id)) return false
      }
      
      // Only show accounts that can have children (Header or Control accounts, or Posting accounts at level < 5)
      if (acc.accountType === "Posting" && acc.level >= 5) return false
      
      return acc.isActive
    })
  }, [accounts, formData.type, isEditMode, accountToEdit])

  // Filter parent accounts by search query
  const filteredParentAccounts = useMemo(() => {
    if (!parentSearchQuery) return validParentAccounts
    
    const query = parentSearchQuery.toLowerCase()
    return validParentAccounts.filter(acc => 
      acc.code.toLowerCase().includes(query) ||
      acc.name.toLowerCase().includes(query) ||
      `${acc.code} - ${acc.name}`.toLowerCase().includes(query)
    )
  }, [validParentAccounts, parentSearchQuery])

  // Get selected parent account
  const selectedParent = useMemo(() => {
    if (!formData.parentId) return null
    return accounts.find(acc => acc.id === formData.parentId) || null
  }, [formData.parentId, accounts])

  useEffect(() => {
    if (open) {
      fetchAccounts()
      if (isEditMode && accountToEdit) {
        // Populate form with existing account data
        setFormData({
          code: accountToEdit.code,
          name: accountToEdit.name,
          type: accountToEdit.type as any,
          description: accountToEdit.description || "",
          parentId: accountToEdit.parentId || "",
          accountType: accountToEdit.accountType as any,
          normalBalance: accountToEdit.normalBalance as any,
          trustFlag: accountToEdit.trustFlag || false,
          cashFlowCategory: (accountToEdit.cashFlowCategory as any) || "",
        })
      } else {
        // Reset form for new account
        setFormData({
          code: "",
          name: "",
          type: "Asset",
          description: "",
          parentId: "",
          accountType: "Posting",
          normalBalance: "Debit",
          trustFlag: false,
          cashFlowCategory: "",
        })
      }
      setErrors({})
      setParentSearchQuery("")
    }
  }, [open, isEditMode, accountToEdit])

  // Update normal balance when account type changes
  useEffect(() => {
    const defaultNormalBalance = NORMAL_BALANCE_RULES[formData.type]
    if (defaultNormalBalance) {
      setFormData(prev => ({ ...prev, normalBalance: defaultNormalBalance }))
    }
  }, [formData.type])

  const fetchAccounts = async () => {
    try {
      const res = await apiService.accounts.getAll({ tree: 'true' })
      const accData = res.data as any
      const accountsData = Array.isArray(accData?.data) ? accData.data : Array.isArray(accData) ? accData : []
      
      // Flatten tree structure for easier searching
      const flattenAccounts = (accs: Account[], result: Account[] = []): Account[] => {
        accs.forEach(acc => {
          result.push(acc)
          if (acc.children && acc.children.length > 0) {
            flattenAccounts(acc.children, result)
          }
        })
        return result
      }
      
      setAccounts(flattenAccounts(accountsData))
    } catch (error) {
      console.error("Failed to fetch accounts:", error)
      toast({
        title: "Error",
        description: "Failed to load accounts. Please refresh the page.",
        variant: "destructive",
      })
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    // Validate code
    if (!formData.code.trim()) {
      newErrors.code = "Account code is required"
    } else {
      // Check uniqueness (skip if editing same account)
      if (!isEditMode || formData.code !== accountToEdit?.code) {
        const existing = accounts.find(acc => acc.code === formData.code)
        if (existing) {
          newErrors.code = `Account code "${formData.code}" already exists`
        }
      }
    }

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = "Account name is required"
    }

    // Validate parent compatibility
    if (formData.parentId) {
      const parent = accounts.find(acc => acc.id === formData.parentId)
      if (!parent) {
        newErrors.parentId = "Selected parent account not found"
      } else {
        // Check type compatibility
        if (parent.type !== formData.type) {
          newErrors.parentId = `Parent account type (${parent.type}) must match child type (${formData.type})`
        }
        
        // Check level compatibility
        const expectedLevel = parent.level + 1
        if (calculatedLevel !== expectedLevel) {
          newErrors.parentId = `Account level must be ${expectedLevel} (parent level + 1)`
        }
        
        // Check if parent can have children
        if (parent.accountType === "Posting" && parent.level >= 5) {
          newErrors.parentId = "Cannot add child to a Level 5 Posting account"
        }
      }
    } else {
      // Root accounts must be level 1
      if (calculatedLevel !== 1) {
        newErrors.parentId = "Root accounts must be level 1"
      }
    }

    // Validate account type and postability
    if (formData.accountType === "Header") {
      // Header accounts cannot be postable
      if (isPostable) {
        newErrors.accountType = "Header accounts cannot be postable. Only Posting accounts at Level 5 can receive transactions."
      }
    }

    // Validate level constraints
    if (calculatedLevel > 5) {
      newErrors.level = "Maximum account level is 5"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setValidating(true)
    const isValid = await validateForm()
    setValidating(false)
    
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form before submitting.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      
      const payload: any = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        type: formData.type,
        level: calculatedLevel,
        accountType: formData.accountType,
        normalBalance: formData.normalBalance,
        description: formData.description.trim() || null,
        isPostable: isPostable,
        trustFlag: formData.trustFlag,
        parentId: formData.parentId || null,
      }
      
      if (formData.cashFlowCategory) {
        payload.cashFlowCategory = formData.cashFlowCategory
      }

      if (isEditMode && accountToEdit) {
        await apiService.accounts.update(accountToEdit.id, payload)
        toast({ 
          title: "Account updated successfully",
          description: `${formData.code} - ${formData.name} has been updated.`
        })
      } else {
        await apiService.accounts.create(payload)
        toast({ 
          title: "Account created successfully",
          description: `${formData.code} - ${formData.name} has been added to the chart of accounts.`
        })
      }
      
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Account save error:", error)
      const errorMessage = error?.response?.data?.error || error?.message || "Unknown error"
      toast({
        title: isEditMode ? "Failed to update account" : "Failed to create account",
        description: errorMessage,
        variant: "destructive",
      })
      // Set specific field errors if provided by backend
      if (error?.response?.data?.errors) {
        setErrors(error.response.data.errors)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[900px] lg:w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditMode ? "Edit Account" : "Add New Account"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update account details in the chart of accounts"
              : "Create a new account in the chart of accounts with proper hierarchy and accounting rules"
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            {/* Account Code and Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code" className="text-sm font-medium">
                  Account Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  placeholder="e.g., 1000, 1001, 2000"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value })
                    if (errors.code) setErrors({ ...errors, code: "" })
                  }}
                  className={errors.code ? "border-destructive" : ""}
                  disabled={isEditMode} // Code cannot be changed after creation
                />
                {errors.code && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.code}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Unique identifier for this account. Cannot be changed after creation.
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Account Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Cash Account, Operating Bank"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (errors.name) setErrors({ ...errors, name: "" })
                  }}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name}
                  </p>
                )}
              </div>
            </div>

            {/* Account Type and Parent Account */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type" className="text-sm font-medium">
                  Account Type <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: any) => {
                    setFormData({ ...formData, type: value, parentId: "" }) // Reset parent when type changes
                    setErrors({ ...errors, parentId: "" })
                  }}
                >
                  <SelectTrigger className={errors.type ? "border-destructive" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asset">Asset</SelectItem>
                    <SelectItem value="Liability">Liability</SelectItem>
                    <SelectItem value="Equity">Equity</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.type}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Determines the accounting category and normal balance
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="parentId" className="text-sm font-medium">
                  Parent Account {formData.parentId && <span className="text-muted-foreground font-normal">(Optional)</span>}
                </Label>
                <Popover open={parentSearchOpen} onOpenChange={setParentSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !formData.parentId && "text-muted-foreground",
                        errors.parentId && "border-destructive"
                      )}
                    >
                      {selectedParent 
                        ? `${selectedParent.code} - ${selectedParent.name}`
                        : "Select parent account (optional)"}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search parent accounts..." 
                        value={parentSearchQuery}
                        onValueChange={setParentSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No parent accounts found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              setFormData({ ...formData, parentId: "" })
                              setParentSearchOpen(false)
                              setErrors({ ...errors, parentId: "" })
                            }}
                          >
                            <CheckCircle2 className={cn(
                              "mr-2 h-4 w-4",
                              !formData.parentId ? "opacity-100" : "opacity-0"
                            )} />
                            None (Root Account)
                          </CommandItem>
                          {filteredParentAccounts.map((account) => (
                            <CommandItem
                              key={account.id}
                              value={`${account.code} - ${account.name}`}
                              onSelect={() => {
                                setFormData({ ...formData, parentId: account.id })
                                setParentSearchOpen(false)
                                setErrors({ ...errors, parentId: "" })
                              }}
                            >
                              <CheckCircle2 className={cn(
                                "mr-2 h-4 w-4",
                                formData.parentId === account.id ? "opacity-100" : "opacity-0"
                              )} />
                              <div className="flex flex-col">
                                <span className="font-medium">{account.code} - {account.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Level {account.level} • {account.accountType}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.parentId && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.parentId}
                  </p>
                )}
                {selectedParent && (
                  <p className="text-xs text-muted-foreground">
                    Parent: Level {selectedParent.level} • {selectedParent.accountType} • {selectedParent.type}
                  </p>
                )}
              </div>
            </div>

            {/* Account Classification */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="accountType" className="text-sm font-medium">
                  Account Classification <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={formData.accountType} 
                  onValueChange={(value: any) => {
                    setFormData({ ...formData, accountType: value })
                    if (errors.accountType) setErrors({ ...errors, accountType: "" })
                  }}
                >
                  <SelectTrigger className={errors.accountType ? "border-destructive" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Header">Header (Summary Account)</SelectItem>
                    <SelectItem value="Control">Control Account</SelectItem>
                    <SelectItem value="Posting">Posting Account</SelectItem>
                  </SelectContent>
                </Select>
                {errors.accountType && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.accountType}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formData.accountType === "Header" && "Summary account, cannot receive transactions"}
                  {formData.accountType === "Control" && "Control account for grouping"}
                  {formData.accountType === "Posting" && "Can receive transactions (Level 5 only)"}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="normalBalance" className="text-sm font-medium">
                  Normal Balance <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={formData.normalBalance} 
                  onValueChange={(value: any) => {
                    setFormData({ ...formData, normalBalance: value })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Debit">Debit</SelectItem>
                    <SelectItem value="Credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default: {NORMAL_BALANCE_RULES[formData.type]} for {formData.type} accounts
                </p>
              </div>

              <div className="grid gap-2">
                <Label className="text-sm font-medium">Calculated Level</Label>
                <div className="flex items-center h-10 px-3 py-2 rounded-md border bg-muted">
                  <Badge variant="outline" className="text-sm">
                    Level {calculatedLevel}
                  </Badge>
                  {calculatedLevel === 5 && formData.accountType === "Posting" && (
                    <Badge variant="default" className="ml-2 text-xs">
                      Postable
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {calculatedLevel === 1 && "Root account"}
                  {calculatedLevel > 1 && `Child of Level ${calculatedLevel - 1} account`}
                  {calculatedLevel === 5 && formData.accountType === "Posting" && " • Can receive transactions"}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Account description and usage notes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Additional Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cashFlowCategory" className="text-sm font-medium">
                  Cash Flow Category
                </Label>
                <Select 
                  value={formData.cashFlowCategory || "none"} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, cashFlowCategory: value === "none" ? "" : value as any })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Operating">Operating Activities</SelectItem>
                    <SelectItem value="Investing">Investing Activities</SelectItem>
                    <SelectItem value="Financing">Financing Activities</SelectItem>
                    <SelectItem value="Escrow">Escrow (Client Funds)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trustFlag"
                    checked={formData.trustFlag}
                    onCheckedChange={(checked) => setFormData({ ...formData, trustFlag: checked as boolean })}
                  />
                  <Label htmlFor="trustFlag" className="text-sm font-normal cursor-pointer">
                    Trust/Escrow Account
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Mark as trust account (restricted usage for client funds)
                </p>
              </div>
            </div>

            {/* Info Alert */}
            {formData.accountType === "Header" && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Header Account:</strong> This account cannot receive transactions. 
                  It can only act as a parent to group child accounts. Only Level 5 Posting accounts can receive journal entries.
                </AlertDescription>
              </Alert>
            )}

            {isPostable && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <strong>Postable Account:</strong> This account can receive transactions. 
                  It is a Level 5 Posting account and will appear in transaction dropdowns.
                </AlertDescription>
              </Alert>
            )}

            {!isPostable && formData.accountType === "Posting" && calculatedLevel < 5 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Non-Postable:</strong> This account cannot receive transactions yet. 
                  Only Level 5 Posting accounts can receive journal entries. Current level: {calculatedLevel}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={loading || validating}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || validating}
              className="min-w-[120px]"
            >
              {validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!loading && !validating && (isEditMode ? "Update Account" : "Create Account")}
              {(loading || validating) && (isEditMode ? "Updating..." : "Creating...")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
