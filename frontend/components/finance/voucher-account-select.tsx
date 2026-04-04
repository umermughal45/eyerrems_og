"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { apiService } from "@/lib/api"
import {
  type VoucherTypeCode,
  type AccountLike,
  getControlType,
  controlTag,
  allowedForPrimary,
  allowedForLine,
  isPostingAccount,
} from "@/lib/voucher-config"

type Context = "primary" | "line"

export interface VoucherAccountSelectProps {
  voucherType: VoucherTypeCode
  context: Context
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  className?: string
}

function useVoucherAccounts(voucherType: VoucherTypeCode, context: Context, open: boolean) {
  const [accounts, setAccounts] = React.useState<AccountLike[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    apiService.accounts
      .getAll({ postable: "true", limit: 500 })
      .then((res: any) => {
        if (cancelled) return
        const data = (res?.data?.data ?? res?.data) ?? []
        const list = Array.isArray(data) ? data : []
        setAccounts(list)
      })
      .catch(() => {
        if (!cancelled) setAccounts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const allowed = React.useMemo(() => {
    return accounts.filter((a) => {
      if (!isPostingAccount(a)) return false
      if (context === "primary") return allowedForPrimary(a, voucherType)
      return allowedForLine(a, voucherType)
    })
  }, [accounts, voucherType, context])

  return { accounts: allowed, loading }
}

function accountLabel(acc: AccountLike, opts?: { breadcrumb?: boolean }): string {
  const code = acc.code ?? ""
  const name = acc.name ?? ""
  const ct = getControlType(acc)
  const tag = controlTag(ct)
  const base =
    opts?.breadcrumb && acc.parent?.name
      ? `${acc.parent.name} › ${code} - ${name}`
      : `${code} - ${name}`
  return tag ? `${base} ${tag}` : base
}

export function VoucherAccountSelect({
  voucherType,
  context,
  value,
  onChange,
  placeholder,
  label,
  required,
  disabled,
  allowEmpty = false,
  emptyLabel = "None",
  className,
}: VoucherAccountSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const { accounts, loading } = useVoucherAccounts(voucherType, context, open)

  const filtered = React.useMemo(() => {
    if (!q.trim()) return accounts
    const lower = q.toLowerCase()
    return accounts.filter(
      (a) =>
        (a.code ?? "").toLowerCase().includes(lower) ||
        (a.name ?? "").toLowerCase().includes(lower),
    )
  }, [accounts, q])

  const selected = React.useMemo(() => accounts.find((a) => a.id === value), [accounts, value])
  const useBreadcrumb = true

  const handleSelect = React.useCallback(
    (id: string) => {
      if (id === "__empty__") {
        onChange(null)
      } else {
        onChange(id)
      }
      setOpen(false)
      setQ("")
    },
    [onChange],
  )

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-xs font-semibold text-muted-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selected ? accountLabel(selected, { breadcrumb: useBreadcrumb }) : placeholder ?? "Select account…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by code or name…"
              value={q}
              onValueChange={setQ}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
                </div>
              ) : (
                <>
                  {allowEmpty && (
                    <CommandGroup>
                      <CommandItem
                        value="__empty__"
                        onSelect={() => handleSelect("__empty__")}
                        className="cursor-pointer"
                      >
                        <Check className={cn("mr-2 h-4 w-4", value == null ? "opacity-100" : "opacity-0")} />
                        {emptyLabel}
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup>
                    {filtered.length === 0 ? (
                      <CommandEmpty>
                        {q ? `No account matching "${q}"` : "No accounts available"}
                      </CommandEmpty>
                    ) : (
                      filtered.map((acc) => (
                        <CommandItem
                          key={acc.id}
                          value={acc.id}
                          onSelect={() => handleSelect(acc.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === acc.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{accountLabel(acc, { breadcrumb: useBreadcrumb })}</span>
                            {acc.type && (
                              <span className="text-xs text-muted-foreground">{acc.type}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
