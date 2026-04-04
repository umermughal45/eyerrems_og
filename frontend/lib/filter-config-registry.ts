/**
 * Filter Config Registry
 * Single source of truth for ALL filter definitions across the ERP.
 * No filter may appear in the UI unless registered here.
 *
 * Usage: Add filters → Reuse UnifiedFilterDrawer → Zero custom filter UI.
 */

export type FilterFieldType =
  | "multi-checkbox"   // Checkbox list (Status, Priority) - no pills
  | "multi-select"    // Searchable dropdown for long lists (Source)
  | "select"
  | "date-range"
  | "numeric-range"
  | "text"
  | "entity-select";

export type OptionsSource =
  | "lead_statuses"
  | "lead_priorities"
  | "lead_sources"
  | "client_statuses"
  | "client_types"
  | "deal_stages"
  | "deal_statuses"
  | "deal_types"
  | "voucher_types"
  | "voucher_statuses"
  | "property_statuses"
  | "property_types"
  | "employee_departments"
  | "employee_statuses"
  | "employee_types"
  | "date_fields"
  | "agents"
  | "dealers"
  | "properties"
  | "clients"
  | "employees"
  | string;

export interface FilterFieldConfig {
  key: string;
  label: string;
  type: FilterFieldType;
  group: string;
  options_source?: OptionsSource;
  options?: Array<{ value: string; label: string }>;
  date_field?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  multiple?: boolean;
}

export interface EntityFilterConfig {
  entity: string;
  tab?: string;
  filters: FilterFieldConfig[];
}

const LEAD_STATUSES = ["new", "qualified", "negotiation", "converted", "lost"];
const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"];
const LEAD_SOURCES = [
  "website", "referral", "social", "campaign", "cold_call", "trade_show",
  "partner", "advertisement", "content", "email", "chat", "phone",
  "walk_in", "other", "linkedin", "facebook", "google", "instagram", "twitter",
];
const CLIENT_STATUSES = ["active", "inactive", "pending"];
const CLIENT_TYPES = ["Individual", "Corporate"];
const DEAL_STAGES = ["qualified", "proposal", "negotiation", "closing", "won", "lost"];
const DEAL_STATUSES = ["open", "won", "lost"];
const DEAL_TYPES = ["sale", "rental", "other"];
const VOUCHER_TYPES = ["BPV", "BRV", "CPV", "CRV", "JV"];
const VOUCHER_STATUSES = ["draft", "submitted", "approved", "posted", "reversed"];
const PROJECT_STATUSES = ["planning", "active", "on-hold", "completed", "closed"];
const EMPLOYEE_STATUSES = ["active", "inactive", "on_leave"];
const EMPLOYEE_TYPES = ["full_time", "part_time", "contract"];
const UNIT_STATUSES = ["Vacant", "Occupied"];
const UNIT_TYPES = ["apartment", "studio", "villa", "commercial", "shop", "office"];
const LEASE_STATUSES = ["active", "expired", "pending", "terminated"];
const TENANT_STATUSES = ["active", "inactive"];
const SALE_STATUSES = ["pending", "completed", "cancelled"];

const DATE_FIELDS_LEAD: Array<{ value: string; label: string }> = [
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "follow_up_date", label: "Follow-up Date" },
  { value: "expected_close_date", label: "Expected Close Date" },
];
const DATE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "month_to_date", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom (From – To)" },
];
const DATE_FIELDS_DEAL: Array<{ value: string; label: string }> = [
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "deal_date", label: "Deal Date" },
  { value: "expected_close_date", label: "Expected Close" },
];
const DATE_FIELDS_VOUCHER: Array<{ value: string; label: string }> = [
  { value: "date", label: "Voucher Date" },
  { value: "created_at", label: "Created Date" },
  { value: "posted_at", label: "Posted Date" },
];
const DATE_FIELDS_EMPLOYEE: Array<{ value: string; label: string }> = [
  { value: "created_at", label: "Created Date" },
  { value: "join_date", label: "Join Date" },
];

/**
 * Filter Config Registry
 * Register all entities and their filter definitions.
 */
export const FILTER_CONFIG_REGISTRY: Record<string, EntityFilterConfig> = {
  leads: {
    entity: "leads",
    filters: [
      // Group 1: Status (PRIMARY) - checkbox list, default all
      { key: "status", label: "Status", type: "multi-checkbox", group: "Status", options: LEAD_STATUSES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
      // Group 2: Priority (SECONDARY)
      { key: "priority", label: "Priority", type: "multi-checkbox", group: "Priority", options: LEAD_PRIORITIES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
      // Group 3: Source - searchable multi-select (scales to 20+)
      { key: "source", label: "Source", type: "multi-select", group: "Source", options: LEAD_SOURCES.map((v) => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })) },
      // Group 4: Assignment (Assigned Agent, Team)
      { key: "assignedTo", label: "Assigned Agent", type: "entity-select", group: "Assignment", options_source: "employees" },
      { key: "team", label: "Team", type: "text", group: "Assignment", placeholder: "Team name" },
      // Group 5: Date
      { key: "dateField", label: "Date Type", type: "select", group: "Date", options: DATE_FIELDS_LEAD },
      { key: "datePreset", label: "Date Range", type: "select", group: "Date", options: DATE_PRESETS },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "amount_min", label: "Min Amount", type: "numeric-range", group: "Financial" },
      { key: "amount_max", label: "Max Amount", type: "numeric-range", group: "Financial" },
    ],
  },
  clients: {
    entity: "clients",
    filters: [
      { key: "status", label: "Status", type: "multi-checkbox", group: "Status", options: CLIENT_STATUSES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
      { key: "clientType", label: "Type", type: "multi-checkbox", group: "Status", options: CLIENT_TYPES.map((v) => ({ value: v.toLowerCase(), label: v })) },
      { key: "assignedDealerId", label: "Assigned Dealer", type: "entity-select", group: "Assignment", options_source: "dealers" },
      { key: "dateField", label: "Date Field", type: "select", group: "Date", options: [{ value: "created_at", label: "Created Date" }, { value: "updated_at", label: "Updated Date" }] },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  deals: {
    entity: "deals",
    filters: [
      { key: "stage", label: "Stage", type: "multi-select", group: "Status", options: DEAL_STAGES.map((v) => ({ value: v, label: v })) },
      { key: "status", label: "Status", type: "multi-select", group: "Status", options: DEAL_STATUSES.map((v) => ({ value: v, label: v })) },
      { key: "dealType", label: "Type", type: "multi-select", group: "Status", options: DEAL_TYPES.map((v) => ({ value: v, label: v })) },
      { key: "clientId", label: "Client", type: "entity-select", group: "Relationships", options_source: "clients" },
      { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_DEAL },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dealAmount_min", label: "Min Amount", type: "numeric-range", group: "Financial" },
      { key: "dealAmount_max", label: "Max Amount", type: "numeric-range", group: "Financial" },
    ],
  },
  dealers: {
    entity: "dealers",
    filters: [
      { key: "isActive", label: "Active", type: "select", group: "Status", options: [
        { value: "true", label: "Yes" },
        { value: "false", label: "No" },
      ]},
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  employees: {
    entity: "employees",
    filters: [
      { key: "status", label: "Status", type: "multi-select", group: "Status", options: EMPLOYEE_STATUSES.map((v) => ({ value: v, label: v })) },
      { key: "employeeType", label: "Type", type: "multi-select", group: "Status", options: EMPLOYEE_TYPES.map((v) => ({ value: v, label: v })) },
      { key: "department", label: "Department", type: "entity-select", group: "Assignment", options_source: "employee_departments" },
      { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_EMPLOYEE },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  vouchers: {
    entity: "vouchers",
    filters: [
      { key: "voucherType", label: "Type", type: "multi-select", group: "Status", options: VOUCHER_TYPES.map((v) => ({ value: v, label: v })) },
      { key: "status", label: "Status", type: "multi-select", group: "Status", options: VOUCHER_STATUSES.map((v) => ({ value: v, label: v })) },
      { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_VOUCHER },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "amount_min", label: "Min Amount", type: "numeric-range", group: "Financial" },
      { key: "amount_max", label: "Max Amount", type: "numeric-range", group: "Financial" },
    ],
  },
  // Voucher type-specific tabs: no type filter (type is fixed per tab)
  "vouchers:bpv": { entity: "vouchers", tab: "bpv", filters: [{ key: "status", label: "Status", type: "multi-select", group: "Status", options: VOUCHER_STATUSES.map((v) => ({ value: v, label: v })) }, { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_VOUCHER }, { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "amount_min", label: "Min Amount", type: "numeric-range", group: "Financial" }, { key: "amount_max", label: "Max Amount", type: "numeric-range", group: "Financial" }] },
  "vouchers:brv": { entity: "vouchers", tab: "brv", filters: [{ key: "status", label: "Status", type: "multi-select", group: "Status", options: VOUCHER_STATUSES.map((v) => ({ value: v, label: v })) }, { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_VOUCHER }, { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "amount_min", label: "Min Amount", type: "numeric-range", group: "Financial" }, { key: "amount_max", label: "Max Amount", type: "numeric-range", group: "Financial" }] },
  "vouchers:cpv": { entity: "vouchers", tab: "cpv", filters: [{ key: "status", label: "Status", type: "multi-select", group: "Status", options: VOUCHER_STATUSES.map((v) => ({ value: v, label: v })) }, { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_VOUCHER }, { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "amount_min", label: "Min Amount", type: "numeric-range", group: "Financial" }, { key: "amount_max", label: "Max Amount", type: "numeric-range", group: "Financial" }] },
  "vouchers:crv": { entity: "vouchers", tab: "crv", filters: [{ key: "status", label: "Status", type: "multi-select", group: "Status", options: VOUCHER_STATUSES.map((v) => ({ value: v, label: v })) }, { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_VOUCHER }, { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "amount_min", label: "Min Amount", type: "numeric-range", group: "Financial" }, { key: "amount_max", label: "Max Amount", type: "numeric-range", group: "Financial" }] },
  "vouchers:jv": { entity: "vouchers", tab: "jv", filters: [{ key: "status", label: "Status", type: "multi-select", group: "Status", options: VOUCHER_STATUSES.map((v) => ({ value: v, label: v })) }, { key: "dateField", label: "Date Field", type: "select", group: "Date", options: DATE_FIELDS_VOUCHER }, { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" }, { key: "amount_min", label: "Min Amount", type: "numeric-range", group: "Financial" }, { key: "amount_max", label: "Max Amount", type: "numeric-range", group: "Financial" }] },
  properties: {
    entity: "properties",
    filters: [
      { key: "status", label: "Status", type: "multi-select", group: "Status", options: [
        { value: "Active", label: "Active" },
        { value: "Maintenance", label: "Maintenance" },
        { value: "Vacant", label: "Vacant" },
        { value: "For Sale", label: "For Sale" },
        { value: "For Rent", label: "For Rent" },
        { value: "Sold", label: "Sold" },
      ] },
      { key: "type", label: "Type", type: "multi-select", group: "Status", options: [
        { value: "apartment", label: "Apartment" },
        { value: "house", label: "House" },
        { value: "commercial", label: "Commercial" },
        { value: "plot", label: "Plot" },
        { value: "villa", label: "Villa" },
      ] },
      { key: "city", label: "City", type: "text", group: "Location", placeholder: "City name" },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  projects: {
    entity: "projects",
    filters: [
      { key: "status", label: "Status", type: "multi-checkbox", group: "Status", options: PROJECT_STATUSES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, " ") })) },
    ],
  },
  // Properties sub-tabs
  "properties:units": {
    entity: "properties",
    tab: "units",
    filters: [
      { key: "unitStatus", label: "Unit Status", type: "multi-select", group: "Status", options: UNIT_STATUSES.map((v) => ({ value: v, label: v })) },
      { key: "propertyId", label: "Property", type: "entity-select", group: "Unit", options_source: "properties" },
      { key: "floorId", label: "Floor", type: "text", group: "Unit", placeholder: "Floor name or ID" },
      { key: "unitType", label: "Unit Type", type: "multi-select", group: "Unit", options: UNIT_TYPES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
      { key: "rent_min", label: "Min Rent", type: "numeric-range", group: "Rent", placeholder: "Min" },
      { key: "rent_max", label: "Max Rent", type: "numeric-range", group: "Rent", placeholder: "Max" },
      { key: "area_min", label: "Min Area (sqft)", type: "numeric-range", group: "Rent", placeholder: "Min" },
      { key: "area_max", label: "Max Area (sqft)", type: "numeric-range", group: "Rent", placeholder: "Max" },
    ],
  },
  "properties:tenants": {
    entity: "properties",
    tab: "tenants",
    filters: [
      { key: "active", label: "Active / Inactive", type: "select", group: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
      { key: "leaseStatus", label: "Lease Status", type: "multi-select", group: "Lease", options: LEASE_STATUSES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
      { key: "propertyId", label: "Property", type: "entity-select", group: "Unit", options_source: "properties" },
      { key: "unitId", label: "Unit", type: "entity-select", group: "Unit", options_source: "units" },
      { key: "moveInFrom", label: "Move-in From", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "moveInTo", label: "Move-in To", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "moveOutFrom", label: "Move-out From", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "moveOutTo", label: "Move-out To", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  "properties:leases": {
    entity: "properties",
    tab: "leases",
    filters: [
      { key: "leaseStatus", label: "Lease Status", type: "multi-select", group: "Status", options: LEASE_STATUSES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
      { key: "startDateFrom", label: "Start Date From", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "startDateTo", label: "Start Date To", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "endDateFrom", label: "End Date From", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "endDateTo", label: "End Date To", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "propertyId", label: "Property", type: "entity-select", group: "Unit", options_source: "properties" },
      { key: "tenantId", label: "Tenant", type: "entity-select", group: "Unit", options_source: "tenants" },
      { key: "rent_min", label: "Min Rent", type: "numeric-range", group: "Rent", placeholder: "Min" },
      { key: "rent_max", label: "Max Rent", type: "numeric-range", group: "Rent", placeholder: "Max" },
    ],
  },
  "properties:sales": {
    entity: "properties",
    tab: "sales",
    filters: [
      { key: "saleStatus", label: "Sale Status", type: "multi-select", group: "Status", options: SALE_STATUSES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
      { key: "propertyId", label: "Property", type: "entity-select", group: "Unit", options_source: "properties" },
      { key: "agentId", label: "Agent", type: "entity-select", group: "Assignment", options_source: "employees" },
      { key: "saleDateFrom", label: "Sale Date From", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "saleDateTo", label: "Sale Date To", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "saleValue_min", label: "Min Sale Value", type: "numeric-range", group: "Financial", placeholder: "Min" },
      { key: "saleValue_max", label: "Max Sale Value", type: "numeric-range", group: "Financial", placeholder: "Max" },
    ],
  },
  "properties:buyers": {
    entity: "properties",
    tab: "buyers",
    filters: [
      { key: "type", label: "Type", type: "multi-select", group: "Status", options: [{ value: "individual", label: "Individual" }, { value: "corporate", label: "Corporate" }] },
      { key: "active", label: "Active / Inactive", type: "select", group: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
      { key: "assignedAgentId", label: "Assigned Agent", type: "entity-select", group: "Assignment", options_source: "employees" },
      { key: "city", label: "City / Area", type: "text", group: "Location", placeholder: "City or area" },
      { key: "createdFrom", label: "Created From", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "createdTo", label: "Created To", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  "properties:sellers": {
    entity: "properties",
    tab: "sellers",
    filters: [
      { key: "type", label: "Type", type: "multi-select", group: "Status", options: [{ value: "individual", label: "Individual" }, { value: "corporate", label: "Corporate" }] },
      { key: "active", label: "Active / Inactive", type: "select", group: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
      { key: "assignedAgentId", label: "Assigned Agent", type: "entity-select", group: "Assignment", options_source: "employees" },
      { key: "city", label: "City / Area", type: "text", group: "Location", placeholder: "City or area" },
      { key: "createdFrom", label: "Created From", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "createdTo", label: "Created To", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  // Finance tabs
  "finance:transactions": {
    entity: "finance",
    tab: "transactions",
    filters: [
      { key: "transactionType", label: "Type", type: "select", group: "Status", options: [{ value: "all", label: "All" }, { value: "income", label: "Income" }, { value: "expense", label: "Expense" }] },
      { key: "status", label: "Status", type: "multi-select", group: "Status", options: [{ value: "completed", label: "Completed" }, { value: "pending", label: "Pending" }, { value: "failed", label: "Failed" }] },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  "finance:invoices": {
    entity: "finance",
    tab: "invoices",
    filters: [
      { key: "status", label: "Status", type: "multi-select", group: "Status", options: [{ value: "paid", label: "Paid" }, { value: "overdue", label: "Overdue" }, { value: "pending", label: "Pending" }] },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  "finance:payments": {
    entity: "finance",
    tab: "payments",
    filters: [
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
  "finance:commissions": {
    entity: "finance",
    tab: "commissions",
    filters: [
      { key: "status", label: "Status", type: "multi-select", group: "Status", options: [{ value: "paid", label: "Paid" }, { value: "pending", label: "Pending" }] },
      { key: "dealerId", label: "Dealer", type: "entity-select", group: "Relationships", options_source: "dealers" },
      { key: "dateFrom", label: "From Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
      { key: "dateTo", label: "To Date", type: "text", group: "Date", placeholder: "YYYY-MM-DD" },
    ],
  },
};

/** Get filter config for entity (and optionally tab) */
export function getFilterConfig(entity: string, tab?: string): EntityFilterConfig | null {
  const key = tab ? `${entity}:${tab}` : entity;
  return FILTER_CONFIG_REGISTRY[key] ?? FILTER_CONFIG_REGISTRY[entity] ?? null;
}

const GROUP_ORDER = ["Status", "Priority", "Source", "Assignment", "Date", "Financial", "Location", "Relationships", "Attributes", "Unit", "Lease", "Rent", "Sale"];

/** Get filters grouped by group name, in hierarchy order */
export function getFiltersByGroup(config: EntityFilterConfig): Record<string, FilterFieldConfig[]> {
  const grouped: Record<string, FilterFieldConfig[]> = {};
  for (const f of config.filters) {
    if (!grouped[f.group]) grouped[f.group] = [];
    grouped[f.group].push(f);
  }
  return grouped;
}

/** Get group names in display order */
export function getGroupOrder(config: EntityFilterConfig): string[] {
  const grouped = getFiltersByGroup(config);
  const groups = Object.keys(grouped);
  return [...GROUP_ORDER.filter((g) => groups.includes(g)), ...groups.filter((g) => !GROUP_ORDER.includes(g))];
}

/** Count active filters from FilterState */
export function countActiveFilters(state: Record<string, unknown>): number {
  let count = 0;
  for (const [k, v] of Object.entries(state)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && v !== null && Object.keys(v).length === 0) continue;
    count++;
  }
  return count;
}
