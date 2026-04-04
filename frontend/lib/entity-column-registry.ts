/**
 * Entity Column Registry
 * Single source of truth for all table columns, filters, and exports across the ERP.
 * 
 * Columns defined here drive:
 * - Table rendering
 * - Advanced filters
 * - Download Report column selection
 * - Export format compatibility
 * - Role-based visibility
 */

export type ExportFormat = "csv" | "excel" | "pdf" | "word";
export type DataType = "string" | "number" | "date" | "boolean" | "currency" | "percentage" | "relation";
export type ColumnGroup = "Basic" | "Contact" | "Financial" | "Status" | "Relationships" | "System" | "Metadata";

export interface EntityColumnDefinition {
  /** Unique column key (matches data field) */
  key: string;
  /** Display label */
  label: string;
  /** Entity this column belongs to */
  entity: string;
  /** Logical group for UI organization */
  group: ColumnGroup;
  /** Data type for formatting/validation */
  data_type: DataType;
  /** Path to value in row object (e.g. "name", "property.name"). Defaults to key if omitted */
  data_path?: string;
  /** Can this column be exported? */
  exportable: boolean;
  /** Which export formats support this column */
  formats: ExportFormat[];
  /** Roles that can see/export this column (empty = all roles) */
  roles: string[];
  /** Can this column be used in filters? */
  filterable: boolean;
  /** Can this column be sorted? */
  sortable: boolean;
  /** Visible by default in table views */
  default_visible: boolean;
  /** Shown in table? (default true if default_visible, false for system-only) */
  table_visible?: boolean;
  /** Is this the Actions column? (exportable=false, always renders a cell) */
  is_action?: boolean;
  /** Column width hint (for table rendering) */
  width?: number;
  /** Format function for display/export */
  format?: (value: any, row?: any) => string;
  /** Relation field path (e.g., "assignedAgent.username") */
  relation_path?: string;
  /** Tooltip/help text */
  description?: string;
}

/**
 * Column Registry
 * All columns for all entities must be registered here.
 */
export const ENTITY_COLUMN_REGISTRY: Record<string, EntityColumnDefinition[]> = {
  lead: [
    {
      key: "tid",
      label: "TID",
      entity: "lead",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 100,
    },
    {
      key: "leadCode",
      label: "Lead Code",
      entity: "lead",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "name",
      label: "Lead Name",
      entity: "lead",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "email",
      label: "Email",
      entity: "lead",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "phone",
      label: "Phone",
      entity: "lead",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "status",
      label: "Status",
      entity: "lead",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "priority",
      label: "Priority",
      entity: "lead",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 100,
    },
    {
      key: "source",
      label: "Source",
      entity: "lead",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "temperature",
      label: "Temperature",
      entity: "lead",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 100,
    },
    {
      key: "interest",
      label: "Interest",
      entity: "lead",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "budgetMin",
      label: "Budget Min",
      entity: "lead",
      group: "Financial",
      data_type: "currency",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 120,
    },
    {
      key: "budgetMax",
      label: "Budget Max",
      entity: "lead",
      group: "Financial",
      data_type: "currency",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 120,
    },
    {
      key: "assignedAgent",
      label: "Assigned Agent",
      entity: "lead",
      group: "Relationships",
      data_type: "relation",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: false,
      default_visible: true,
      width: 150,
      relation_path: "assignedAgent.username",
      format: (v) => v?.username || v?.name || "",
    },
    {
      key: "assignedDealer",
      label: "Assigned Dealer",
      entity: "lead",
      group: "Relationships",
      data_type: "relation",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: false,
      default_visible: false,
      width: 150,
      relation_path: "assignedDealer.name",
      format: (v) => v?.name || "",
    },
    {
      key: "createdAt",
      label: "Created Date",
      entity: "lead",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "updatedAt",
      label: "Updated Date",
      entity: "lead",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
    {
      key: "id",
      label: "ID",
      entity: "lead",
      group: "System",
      data_type: "string",
      exportable: false,
      formats: [],
      roles: [],
      filterable: false,
      sortable: false,
      default_visible: false,
    },
  ],
  client: [
    {
      key: "tid",
      label: "TID",
      entity: "client",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 100,
    },
    {
      key: "clientCode",
      label: "Client Code",
      entity: "client",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "name",
      label: "Name",
      entity: "client",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "email",
      label: "Email",
      entity: "client",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "phone",
      label: "Phone",
      entity: "client",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "status",
      label: "Status",
      entity: "client",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "clientType",
      label: "Type",
      entity: "client",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "city",
      label: "City",
      entity: "client",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
    {
      key: "assignedDealer",
      label: "Assigned Dealer",
      entity: "client",
      group: "Relationships",
      data_type: "relation",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: false,
      default_visible: true,
      width: 150,
      relation_path: "assignedDealer.name",
      format: (v) => v?.name || "",
    },
    {
      key: "createdAt",
      label: "Created Date",
      entity: "client",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
  ],
  dealer: [
    {
      key: "tid",
      label: "TID",
      entity: "dealer",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 100,
    },
    {
      key: "dealerCode",
      label: "Dealer Code",
      entity: "dealer",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "name",
      label: "Name",
      entity: "dealer",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "email",
      label: "Email",
      entity: "dealer",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "phone",
      label: "Phone",
      entity: "dealer",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "isActive",
      label: "Active",
      entity: "dealer",
      group: "Status",
      data_type: "boolean",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 100,
    },
    {
      key: "commissionRate",
      label: "Commission Rate",
      entity: "dealer",
      group: "Financial",
      data_type: "percentage",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 120,
    },
    {
      key: "city",
      label: "City",
      entity: "dealer",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
    {
      key: "createdAt",
      label: "Created Date",
      entity: "dealer",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
  ],
  deal: [
    {
      key: "tid",
      label: "TID",
      entity: "deal",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 100,
    },
    {
      key: "dealCode",
      label: "Deal Code",
      entity: "deal",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "title",
      label: "Title",
      entity: "deal",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 250,
    },
    {
      key: "client",
      label: "Client",
      entity: "deal",
      group: "Relationships",
      data_type: "relation",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: false,
      default_visible: true,
      width: 200,
      relation_path: "client.name",
      format: (v) => v?.name || "",
    },
    {
      key: "dealAmount",
      label: "Amount",
      entity: "deal",
      group: "Financial",
      data_type: "currency",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "stage",
      label: "Stage",
      entity: "deal",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "status",
      label: "Status",
      entity: "deal",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "dealType",
      label: "Type",
      entity: "deal",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "dealDate",
      label: "Deal Date",
      entity: "deal",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "createdAt",
      label: "Created Date",
      entity: "deal",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
  ],
  employee: [
    {
      key: "tid",
      label: "TID",
      entity: "employee",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 100,
    },
    {
      key: "employeeId",
      label: "Employee ID",
      entity: "employee",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "name",
      label: "Name",
      entity: "employee",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "email",
      label: "Email",
      entity: "employee",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: ["admin", "hr_manager"],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 200,
    },
    {
      key: "phone",
      label: "Phone",
      entity: "employee",
      group: "Contact",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: ["admin", "hr_manager"],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
    {
      key: "department",
      label: "Department",
      entity: "employee",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "position",
      label: "Position",
      entity: "employee",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "status",
      label: "Status",
      entity: "employee",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "joinDate",
      label: "Join Date",
      entity: "employee",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "salary",
      label: "Salary",
      entity: "employee",
      group: "Financial",
      data_type: "currency",
      exportable: true,
      formats: ["csv", "excel"],
      roles: ["admin", "hr_manager"],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
    {
      key: "createdAt",
      label: "Created Date",
      entity: "employee",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
  ],
  voucher: [
    {
      key: "voucherNumber",
      label: "Voucher #",
      entity: "voucher",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "type",
      label: "Type",
      entity: "voucher",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 100,
    },
    {
      key: "date",
      label: "Date",
      entity: "voucher",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "status",
      label: "Status",
      entity: "voucher",
      group: "Status",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf", "word"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 120,
    },
    {
      key: "amount",
      label: "Amount",
      entity: "voucher",
      group: "Financial",
      data_type: "currency",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: true,
      width: 150,
    },
    {
      key: "description",
      label: "Description",
      entity: "voucher",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: false,
      default_visible: true,
      width: 300,
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
      entity: "voucher",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
    {
      key: "referenceNumber",
      label: "Reference #",
      entity: "voucher",
      group: "Basic",
      data_type: "string",
      exportable: true,
      formats: ["csv", "excel"],
      roles: [],
      filterable: true,
      sortable: false,
      default_visible: false,
      width: 150,
    },
    {
      key: "createdAt",
      label: "Created Date",
      entity: "voucher",
      group: "System",
      data_type: "date",
      exportable: true,
      formats: ["csv", "excel", "pdf"],
      roles: [],
      filterable: true,
      sortable: true,
      default_visible: false,
      width: 150,
    },
    {
      key: "id",
      label: "ID",
      entity: "voucher",
      group: "System",
      data_type: "string",
      exportable: false,
      formats: [],
      roles: [],
      filterable: false,
      sortable: false,
      default_visible: false,
    },
  ],
  property: [
    { key: "name", label: "Property", entity: "property", group: "Basic", data_type: "string", data_path: "name", exportable: true, formats: ["csv", "excel", "pdf", "word"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 220 },
    { key: "tid", label: "TID", entity: "property", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
    { key: "type", label: "Type", entity: "property", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "status", label: "Status", entity: "property", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf", "word"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "address", label: "Address", entity: "property", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 200 },
    { key: "unitsDisplay", label: "Units", entity: "property", group: "Basic", data_type: "string", exportable: false, formats: [], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 100, format: (_: any, row?: any) => { const u = row?.units ?? row?._count?.units ?? 0; const o = row?.occupied ?? 0; return `${o}/${u}`; } },
    { key: "occupiedDisplay", label: "Occupied", entity: "property", group: "Basic", data_type: "string", exportable: false, formats: [], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 100, format: (_: any, row?: any) => { const u = row?.units ?? row?._count?.units ?? 0; const o = row?.occupied ?? 0; return u > 0 ? `${Math.round((o / u) * 100)}%` : "—"; } },
    { key: "salePrice", label: "Sale Price", entity: "property", group: "Financial", data_type: "currency", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 140 },
    { key: "revenue", label: "Revenue", entity: "property", group: "Financial", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 120 },
    { key: "propertyCode", label: "Property Code", entity: "property", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: false, table_visible: false, width: 120 },
    { key: "city", label: "City", entity: "property", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: false, table_visible: false, width: 150 },
    { key: "totalUnits", label: "Total Units", entity: "property", group: "Basic", data_type: "number", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: false, table_visible: false, width: 120 },
    { key: "createdAt", label: "Created Date", entity: "property", group: "System", data_type: "date", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: false, table_visible: false, width: 150 },
  ],
  unit: [
    { key: "unitName", label: "Unit", entity: "unit", group: "Basic", data_type: "string", data_path: "unitName", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 150, format: (v: any, row?: any) => row?.unitName || row?.unitNumber || v || "—" },
    { key: "property", label: "Property", entity: "unit", group: "Relationships", data_type: "relation", data_path: "property.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180, format: (v: any, row?: any) => row?.property?.name || row?.property || v || "—" },
    { key: "floor", label: "Floor", entity: "unit", group: "Basic", data_type: "relation", data_path: "floor.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 120, format: (v: any, row?: any) => row?.floor?.name || v || "—" },
    { key: "block", label: "Block", entity: "unit", group: "Basic", data_type: "relation", data_path: "block.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 120, format: (v: any, row?: any) => row?.block?.name || v || "—" },
    { key: "monthlyRent", label: "Rent", entity: "unit", group: "Financial", data_type: "currency", data_path: "monthlyRent", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120, format: (v: any, row?: any) => { const r = row?.monthlyRent ?? row?.rent ?? v; return r != null ? `Rs ${Number(r).toLocaleString()}` : "—"; } },
    { key: "status", label: "Status", entity: "unit", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
    { key: "tenantName", label: "Tenant", entity: "unit", group: "Relationships", data_type: "relation", data_path: "tenant.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 150, format: (v: any, row?: any) => row?.tenant?.name || row?.tenantName || row?.tenant || v || "—" },
  ],
  tenant: [
    { key: "name", label: "Name", entity: "tenant", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 200 },
    { key: "tid", label: "TID", entity: "tenant", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
    { key: "email", label: "Email", entity: "tenant", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 200 },
    { key: "phone", label: "Phone", entity: "tenant", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 140 },
    { key: "status", label: "Status", entity: "tenant", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
  ],
  lease: [
    { key: "id", label: "Lease #", entity: "lease", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 120, format: (v: any) => v ? String(v).slice(0, 8) : "—" },
    { key: "tenantName", label: "Tenant", entity: "lease", group: "Relationships", data_type: "relation", data_path: "tenant.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180, format: (v: any, row?: any) => row?.tenant?.name || row?.tenantName || row?.tenant || v || "—" },
    { key: "propertyUnit", label: "Property / Unit", entity: "lease", group: "Relationships", data_type: "string", exportable: false, formats: [], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 220, format: (_: any, row?: any) => { const p = row?.unit?.property?.name || row?.propertyName || row?.property || "—"; const u = row?.unit?.unitName || row?.unitName || row?.unit || ""; return u ? `${p} - ${u}` : p; } },
    { key: "leasePeriod", label: "Lease Period", entity: "lease", group: "System", data_type: "string", exportable: false, formats: [], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 180, format: (_: any, row?: any) => { const s = row?.leaseStart ? new Date(row.leaseStart).toLocaleDateString() : "—"; const e = row?.leaseEnd ? new Date(row.leaseEnd).toLocaleDateString() : "—"; return `${s} - ${e}`; } },
    { key: "rent", label: "Monthly Rent", entity: "lease", group: "Financial", data_type: "currency", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 130 },
    { key: "status", label: "Status", entity: "lease", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
  ],
  sale: [
    { key: "propertyName", label: "Property", entity: "sale", group: "Relationships", data_type: "relation", data_path: "property.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180, format: (v: any, row?: any) => row?.property?.name || row?.propertyName || row?.property || v || "—" },
    { key: "buyerName", label: "Buyer", entity: "sale", group: "Relationships", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180, format: (_: any, row?: any) => (row?.buyers?.[0]?.name || row?.buyer || row?.buyerName || "—") },
    { key: "dealer", label: "Dealer/Agent", entity: "sale", group: "Relationships", data_type: "relation", data_path: "dealer.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 150, format: (v: any, row?: any) => row?.dealer?.name || row?.dealer || v || "—" },
    { key: "saleValue", label: "Sale Price", entity: "sale", group: "Financial", data_type: "currency", data_path: "saleValue", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 140, format: (v: any, row?: any) => { const s = row?.saleValue ?? row?.salePrice ?? v; return s != null ? `Rs ${Number(s).toLocaleString()}` : "—"; } },
    { key: "commission", label: "Commission", entity: "sale", group: "Financial", data_type: "currency", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "saleDate", label: "Sale Date", entity: "sale", group: "System", data_type: "date", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "status", label: "Status", entity: "sale", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
  ],
  buyer: [
    { key: "name", label: "Name", entity: "buyer", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 200 },
    { key: "email", label: "Email", entity: "buyer", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 200 },
    { key: "phone", label: "Phone", entity: "buyer", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 140 },
    { key: "buyStatus", label: "Status", entity: "buyer", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100, format: (v: any, row?: any) => row?.buyStatus || row?.status || v || "—" },
  ],
  seller: [
    { key: "name", label: "Name", entity: "seller", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 200 },
    { key: "email", label: "Email", entity: "seller", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 200 },
    { key: "phone", label: "Phone", entity: "seller", group: "Contact", data_type: "string", exportable: true, formats: ["csv", "excel"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 140 },
    { key: "propertyName", label: "Property", entity: "seller", group: "Relationships", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180 },
  ],
  transaction: [
    { key: "date", label: "Date", entity: "transaction", group: "System", data_type: "date", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "transactionCode", label: "Code", entity: "transaction", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "category", label: "Category", entity: "transaction", group: "Basic", data_type: "relation", data_path: "transactionCategory.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 150, format: (v: any, row?: any) => row?.transactionCategory?.name || row?.category || v || "—" },
    { key: "description", label: "Description", entity: "transaction", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 220 },
    { key: "transactionType", label: "Type", entity: "transaction", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
    { key: "totalAmount", label: "Amount", entity: "transaction", group: "Financial", data_type: "currency", data_path: "totalAmount", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120, format: (v: any, row?: any) => { const a = row?.totalAmount ?? row?.amount ?? v; return a != null ? `Rs ${Number(a).toLocaleString()}` : "—"; } },
    { key: "status", label: "Status", entity: "transaction", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
  ],
  invoice: [
    { key: "invoiceNumber", label: "Invoice #", entity: "invoice", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 140 },
    { key: "tenant", label: "Tenant", entity: "invoice", group: "Relationships", data_type: "relation", data_path: "tenant.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180, format: (v: any, row?: any) => (typeof row?.tenant === "object" ? row?.tenant?.name : row?.tenant) || v || "—" },
    { key: "property", label: "Property", entity: "invoice", group: "Relationships", data_type: "relation", data_path: "property.name", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180, format: (v: any, row?: any) => (typeof row?.property === "object" ? row?.property?.name || row?.property?.address : row?.property) || v || "—" },
    { key: "totalAmount", label: "Amount", entity: "invoice", group: "Financial", data_type: "currency", data_path: "totalAmount", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120, format: (v: any, row?: any) => { const a = row?.totalAmount ?? row?.amount ?? v; return a != null ? `Rs ${Number(a).toLocaleString()}` : "—"; } },
    { key: "issueDate", label: "Issue Date", entity: "invoice", group: "System", data_type: "date", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 110 },
    { key: "dueDate", label: "Due Date", entity: "invoice", group: "System", data_type: "date", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 110 },
    { key: "status", label: "Status", entity: "invoice", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
  ],
  payment: [
    { key: "paymentId", label: "Payment ID", entity: "payment", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 140 },
    { key: "deal", label: "Deal", entity: "payment", group: "Relationships", data_type: "relation", data_path: "deal.trackingId", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 160, format: (v: any, row?: any) => row?.deal?.trackingId || row?.deal?.title || v || "—" },
    { key: "clientProperty", label: "Client / Property", entity: "payment", group: "Relationships", data_type: "string", exportable: false, formats: [], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 200, format: (_: any, row?: any) => { const c = row?.deal?.client?.name || "—"; const p = row?.deal?.property?.name || ""; return p ? `${c} / ${p}` : c; } },
    { key: "paymentTypeDisplay", label: "Payment", entity: "payment", group: "Basic", data_type: "string", exportable: false, formats: [], roles: [], filterable: false, sortable: false, default_visible: true, table_visible: true, width: 120, format: (_: any, row?: any) => { const t = row?.paymentType || ""; const m = (row?.paymentMode || "").replace("_", " "); return t && m ? `${t} / ${m}` : t || m || "—"; } },
    { key: "amount", label: "Amount", entity: "payment", group: "Financial", data_type: "currency", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "date", label: "Date", entity: "payment", group: "System", data_type: "date", data_path: "paymentDate", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 110, format: (v: any, row?: any) => { const d = row?.paymentDate ?? row?.date ?? v; return d ? new Date(d).toLocaleDateString() : "—"; } },
  ],
  commission: [
    { key: "id", label: "Commission ID", entity: "commission", group: "Basic", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 120 },
    { key: "dealerName", label: "Dealer", entity: "commission", group: "Relationships", data_type: "string", data_path: "dealerName", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180 },
    { key: "transactionType", label: "Transaction Type", entity: "commission", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 130 },
    { key: "propertyName", label: "Property", entity: "commission", group: "Relationships", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: false, default_visible: true, table_visible: true, width: 180 },
    { key: "saleAmount", label: "Sale Amount", entity: "commission", group: "Financial", data_type: "currency", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 130 },
    { key: "commissionRate", label: "Rate", entity: "commission", group: "Financial", data_type: "percentage", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 80 },
    { key: "commissionAmount", label: "Commission", entity: "commission", group: "Financial", data_type: "currency", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 120 },
    { key: "date", label: "Date", entity: "commission", group: "System", data_type: "date", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 110 },
    { key: "status", label: "Status", entity: "commission", group: "Status", data_type: "string", exportable: true, formats: ["csv", "excel", "pdf"], roles: [], filterable: true, sortable: true, default_visible: true, table_visible: true, width: 100 },
  ],
};

/**
 * Get columns for an entity
 */
export function getEntityColumns(entity: string): EntityColumnDefinition[] {
  return ENTITY_COLUMN_REGISTRY[entity] || [];
}

/**
 * Get exportable columns for an entity, filtered by format and role
 */
export function getExportableColumns(
  entity: string,
  format: ExportFormat,
  userRoles: string[] = []
): EntityColumnDefinition[] {
  const all = getEntityColumns(entity);
  return all.filter((col) => {
    if (col.is_action) return false;
    if (!col.exportable) return false;
    if (!col.formats.includes(format)) return false;
    if (col.roles.length > 0 && !col.roles.some((r) => userRoles.includes(r))) return false;
    return true;
  });
}

/**
 * Check if entity has any exportable columns for format
 */
export function hasExportableColumns(
  entity: string,
  format: ExportFormat,
  userRoles: string[] = []
): boolean {
  return getExportableColumns(entity, format, userRoles).length > 0;
}

/**
 * Get columns grouped by group
 */
export function getColumnsByGroup(
  entity: string,
  format?: ExportFormat,
  userRoles: string[] = []
): Record<ColumnGroup, EntityColumnDefinition[]> {
  const cols = format
    ? getExportableColumns(entity, format, userRoles)
    : getEntityColumns(entity);
  const grouped: Record<string, EntityColumnDefinition[]> = {};
  for (const col of cols) {
    if (!grouped[col.group]) grouped[col.group] = [];
    grouped[col.group].push(col);
  }
  return grouped as Record<ColumnGroup, EntityColumnDefinition[]>;
}

/**
 * Get default visible columns for table rendering
 */
export function getDefaultVisibleColumns(entity: string): EntityColumnDefinition[] {
  return getEntityColumns(entity).filter((col) => col.default_visible);
}

/**
 * Get table columns for an entity (table_visible + Actions).
 * Header count will ALWAYS equal row cell count.
 */
export function getTableColumns(entity: string): EntityColumnDefinition[] {
  const all = getEntityColumns(entity);
  const tableCols = all.filter(
    (col) => col.is_action || (col.table_visible !== false && col.default_visible)
  );
  const hasActions = tableCols.some((c) => c.is_action);
  if (!hasActions) {
    tableCols.push({
      key: "actions",
      label: "Actions",
      entity,
      group: "System",
      data_type: "string",
      exportable: false,
      formats: [],
      roles: [],
      filterable: false,
      sortable: false,
      default_visible: true,
      table_visible: true,
      is_action: true,
    });
  }
  return tableCols;
}

/**
 * Resolve cell value from row using column's data_path or key.
 */
export function getCellValue(col: EntityColumnDefinition, row: any): any {
  const path = col.data_path ?? col.key;
  const parts = path.split(".");
  let v: any = row;
  for (const p of parts) {
    v = v?.[p];
    if (v == null) break;
  }
  return v;
}

/**
 * Format column value for display/export
 */
export function formatColumnValue(
  col: EntityColumnDefinition,
  value: any,
  row?: any
): string {
  if (col.format) return col.format(value, row);
  if (value == null) return "";
  if (col.data_type === "date") {
    if (value instanceof Date) return value.toISOString().split("T")[0];
    if (typeof value === "string") {
      try {
        return new Date(value).toISOString().split("T")[0];
      } catch {
        return value;
      }
    }
    return String(value);
  }
  if (col.data_type === "boolean") {
    return value === true || value === "true" || value === 1 ? "Yes" : "No";
  }
  if (col.data_type === "currency") {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num) ? "" : `Rs ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (col.data_type === "percentage") {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num) ? "" : `${num}%`;
  }
  if (col.data_type === "relation" && col.relation_path && typeof value === "object") {
    const parts = col.relation_path.split(".");
    let v = value;
    for (const p of parts) {
      v = v?.[p];
      if (v == null) break;
    }
    return v != null ? String(v) : "";
  }
  return String(value);
}
