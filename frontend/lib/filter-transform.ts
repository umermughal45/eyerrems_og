/**
 * Filter Transform
 * Converts FilterState (unified) to API-specific payloads.
 * Used for list APIs and Download Report.
 */

import type { FilterState } from "@/components/shared/unified-filter-drawer"
import type { GlobalFilterPayload } from "@/components/ui/global-filter-dialog"

const DEFAULT_PAGINATION = { page: 1, limit: 25 }
const DEFAULT_SORTING = { field: "created_at", direction: "desc" as const }

/** Convert FilterState to GlobalFilterPayload (for CRM Enhanced / Leads API) */
export function toGlobalFilterPayload(
  state: FilterState,
  overrides?: { search?: string; pagination?: { page: number; limit: number }; sorting?: { field: string; direction: "asc" | "desc" } }
): GlobalFilterPayload {
  const status = Array.isArray(state.status) ? state.status : state.status ? [String(state.status)] : []
  const priority = Array.isArray(state.priority) ? state.priority : state.priority ? [String(state.priority)] : []
  const stage = Array.isArray(state.stage) ? state.stage : state.stage ? [String(state.stage)] : []
  const assignedUsers = state.assignedTo ? [String(state.assignedTo)] : []
  const teams = state.team ? [String(state.team)] : []

  const payload: GlobalFilterPayload = {
    identity: { system_ids: [], reference_codes: [], tids: [] },
    status,
    lifecycle: [],
    priority,
    stage,
    ownership: {
      assigned_users: assignedUsers,
      teams,
      departments: [],
      dealers: [],
      agents: [],
      created_by: [],
      approved_by: [],
    },
    relationships: { has_related: [], missing_related: [] },
    pagination: overrides?.pagination ?? DEFAULT_PAGINATION,
    sorting: overrides?.sorting ?? DEFAULT_SORTING,
    search: overrides?.search,
  }

  const validDateFields = ["created_at", "updated_at", "approved_at", "posted_at", "date", "follow_up_date", "expected_close_date", "deal_date", "join_date"] as const
  if (state.dateField || state.dateFrom || state.dateTo || state.datePreset) {
    const field = (state.dateField as string) || "created_at"
    payload.date = {
      field: validDateFields.includes(field as any) ? (field as typeof validDateFields[number]) : "created_at",
      from: state.dateFrom as string | null | undefined,
      to: state.dateTo as string | null | undefined,
      preset: state.datePreset as "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | "custom" | undefined,
    }
  }

  if (state.amount_min != null || state.amount_max != null || state.dealAmount_min != null || state.dealAmount_max != null) {
    payload.numeric_ranges = {
      amount_min: (state.amount_min ?? state.dealAmount_min) as number | null | undefined,
      amount_max: (state.amount_max ?? state.dealAmount_max) as number | null | undefined,
    }
  }

  return payload
}

/** Leads-specific: extends GlobalFilterPayload with source */
export function toLeadsFilterPayload(
  state: FilterState,
  overrides?: { search?: string; pagination?: { page: number; limit: number }; sorting?: { field: string; direction: "asc" | "desc" } }
): GlobalFilterPayload & { source?: string[] } {
  const payload = toGlobalFilterPayload(state, overrides) as GlobalFilterPayload & { source?: string[] }
  if (state.source != null) {
    const src = Array.isArray(state.source) ? state.source : [String(state.source)]
    if (src.length) payload.source = src
  }
  return payload
}

/** Convert FilterState to simple filters (for clients, dealers, employees, vouchers, properties APIs) */
export function toSimpleFilters(state: FilterState): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  if (state.status != null) {
    const s = Array.isArray(state.status) ? state.status : [state.status]
    if (s.length === 1) out.status = s[0]
    else if (s.length > 1) out.status = s
  }
  if (state.clientType != null) {
    const t = Array.isArray(state.clientType) ? state.clientType : [state.clientType]
    if (t.length === 1) out.clientType = t[0]
    else if (t.length > 1) out.clientType = t
  }
  if (state.stage != null) {
    const s = Array.isArray(state.stage) ? state.stage : [state.stage]
    if (s.length === 1) out.stage = s[0]
    else if (s.length > 1) out.stage = s
  }
  if (state.dealType != null) {
    const t = Array.isArray(state.dealType) ? state.dealType : [state.dealType]
    if (t.length === 1) out.dealType = t[0]
  }
  if (state.voucherType != null) {
    const v = Array.isArray(state.voucherType) ? state.voucherType : [state.voucherType]
    if (v.length === 1) out.voucherType = v[0]
  }
  if (state.employeeType != null) {
    const t = Array.isArray(state.employeeType) ? state.employeeType : [state.employeeType]
    if (t.length === 1) out.employeeType = t[0]
  }
  if (state.department != null) out.department = state.department
  if (state.assignedDealerId != null) out.assignedDealerId = state.assignedDealerId
  if (state.clientId != null) out.clientId = state.clientId
  if (state.isActive != null) out.isActive = state.isActive === "true" || state.isActive === true
  if (state.type != null) {
    const t = Array.isArray(state.type) ? state.type : [state.type]
    if (t.length === 1) out.type = t[0]
    else if (t.length > 1) out.type = t
  }
  if (state.city != null) out.city = state.city

  if (state.dateFrom != null || state.dateTo != null) {
    const dateFilter: Record<string, unknown> = {}
    if (state.dateFrom) dateFilter.gte = new Date(String(state.dateFrom)).toISOString()
    if (state.dateTo) dateFilter.lte = new Date(String(state.dateTo)).toISOString()
    const field = (state.dateField as string) || "createdAt"
    out[field === "created_at" ? "createdAt" : field === "date" ? "date" : field] = dateFilter
  }

  return out
}

/** Convert FilterState to export API filters (for Download Report) */
export function toExportFilters(state: FilterState, entity: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  if (state.status != null) {
    out.status = Array.isArray(state.status) ? state.status : [state.status]
  }
  if (state.priority != null) {
    out.priority = Array.isArray(state.priority) ? state.priority : [state.priority]
  }
  if (state.source != null) {
    out.source = Array.isArray(state.source) ? state.source : [state.source]
  }
  if (state.assignedTo != null) out.assignedTo = state.assignedTo
  if (state.stage != null) {
    out.stage = Array.isArray(state.stage) ? state.stage : [state.stage]
  }
  if (state.clientType != null) {
    out.clientType = Array.isArray(state.clientType) ? state.clientType[0] : state.clientType
  }
  if (state.voucherType != null) {
    out.voucherType = Array.isArray(state.voucherType) ? state.voucherType[0] : state.voucherType
  }
  if (state.employeeType != null) {
    out.employeeType = Array.isArray(state.employeeType) ? state.employeeType[0] : state.employeeType
  }
  if (state.department != null) out.department = state.department
  if (state.assignedDealerId != null) out.assignedDealerId = state.assignedDealerId
  if (state.clientId != null) out.clientId = state.clientId
  if (state.isActive != null) out.isActive = state.isActive === "true" || state.isActive === true
  if (state.type != null) {
    const t = Array.isArray(state.type) ? state.type : [state.type]
    out.type = t.length === 1 ? t[0] : t
  }
  if (state.city != null) out.city = state.city
  if (state.unitStatus != null) out.unitStatus = Array.isArray(state.unitStatus) ? state.unitStatus : [state.unitStatus]
  if (state.propertyId != null) out.propertyId = state.propertyId
  if (state.unitId != null) out.unitId = state.unitId
  if (state.unitType != null) out.unitType = Array.isArray(state.unitType) ? state.unitType : [state.unitType]
  if (state.leaseStatus != null) out.leaseStatus = Array.isArray(state.leaseStatus) ? state.leaseStatus : [state.leaseStatus]
  if (state.tenantId != null) out.tenantId = state.tenantId
  if (state.saleStatus != null) out.saleStatus = Array.isArray(state.saleStatus) ? state.saleStatus : [state.saleStatus]
  if (state.agentId != null) out.agentId = state.agentId
  if (state.assignedAgentId != null) out.assignedAgentId = state.assignedAgentId
  if (state.rent_min != null) out.rent_min = state.rent_min
  if (state.rent_max != null) out.rent_max = state.rent_max
  if (state.area_min != null) out.area_min = state.area_min
  if (state.area_max != null) out.area_max = state.area_max
  if (state.saleValue_min != null) out.saleValue_min = state.saleValue_min
  if (state.saleValue_max != null) out.saleValue_max = state.saleValue_max
  if (state.transactionType != null && state.transactionType !== "all") out.transactionType = state.transactionType
  if (state.dealerId != null) out.dealerId = state.dealerId

  if (state.dateField != null) out.dateField = state.dateField
  if (state.dateFrom != null) out.dateFrom = state.dateFrom
  if (state.dateTo != null) out.dateTo = state.dateTo

  const amountMin = state.amount_min ?? state.dealAmount_min
  const amountMax = state.amount_max ?? state.dealAmount_max
  if (amountMin != null || amountMax != null) {
    out.amount = { min: amountMin, max: amountMax }
  }

  return out
}
