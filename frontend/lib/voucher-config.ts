/**
 * Voucher-type configuration and account helpers for ERP voucher UI.
 * Rules drive behavior; no hardcoded per-type branches in forms.
 */

export type VoucherTypeCode = "BPV" | "BRV" | "CPV" | "CRV" | "JV";
export type ControlType = "CASH" | "BANK" | "AR" | "AP" | "NONE";
export type AccountCategory =
  | "ASSET"
  | "LIABILITY"
  | "EXPENSE"
  | "INCOME"
  | "EQUITY";

export interface AccountLike {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  level?: number;
  isPostable?: boolean;
  accountType?: string;
  parent?: { code?: string; name?: string; id?: string } | null;
}

/** Derive control type from code/name (align with backend). */
export function getControlType(acc: AccountLike): ControlType {
  const c = (acc.code ?? "").trim();
  const n = (acc.name ?? "").toLowerCase();
  if (
    c.startsWith("1111") ||
    c.startsWith("111101") ||
    c.startsWith("111102") ||
    n.includes("cash")
  )
    return "CASH";
  if (
    c.startsWith("1112") ||
    c.startsWith("111201") ||
    c.startsWith("111202") ||
    n.includes("bank")
  )
    return "BANK";
  if (c.startsWith("113") || n.includes("receivable")) return "AR";
  if (c.startsWith("212") || n.includes("payable")) return "AP";
  return "NONE";
}

/** Map API type to category. */
export function getAccountCategory(acc: AccountLike): AccountCategory {
  const t = (acc.type ?? "").toLowerCase();
  if (t === "asset") return "ASSET";
  if (t === "liability") return "LIABILITY";
  if (t === "revenue") return "INCOME";
  if (t === "expense") return "EXPENSE";
  if (t === "equity") return "EQUITY";
  return "ASSET";
}

export function isPostingAccount(acc: AccountLike): boolean {
  if (acc.level != null && acc.level !== 5) return false;
  if (acc.isPostable === false) return false;
  if (acc.accountType === "Header") return false;
  return true;
}

/** Breadcrumb path from parent chain (one-level parent only). */
export function accountBreadcrumb(acc: AccountLike): string {
  const parts: string[] = [];
  let p = acc.parent;
  while (p?.name) {
    parts.unshift(p.name);
    p = (p as any)?.parent ?? null;
  }
  parts.push(`${acc.code ?? ""} - ${acc.name ?? ""}`);
  return parts.join(" > ");
}

export interface VoucherTypeConfig {
  code: VoucherTypeCode;
  name: string;
  /** Control account type. null = JV, no control. */
  control: ControlType | null;
  /** Which side the control account is on. */
  controlSide: "debit" | "credit" | null;
  /** Line account categories allowed (user lines). */
  allowedLineCategories: AccountCategory[];
  /** Control types forbidden in user lines (hidden). */
  forbiddenLineControl: ControlType[];
  /** For payment/receipt: which side user lines use. */
  lineSide: "debit" | "credit" | "both";
  /** Forbidden categories on user lines (e.g. no INCOME on debit for BPV). */
  forbiddenLineCategories: AccountCategory[];
  /** Min user lines (excluding control). */
  minUserLines: number;
  /** JV-only: no control row. */
  noControlRow: boolean;
}

export const VOUCHER_CONFIG: Record<VoucherTypeCode, VoucherTypeConfig> = {
  BPV: {
    code: "BPV",
    name: "Bank Payment Voucher",
    control: "BANK",
    controlSide: "credit",
    allowedLineCategories: ["EXPENSE", "ASSET", "LIABILITY"],
    forbiddenLineControl: ["CASH", "BANK"],
    lineSide: "debit",
    forbiddenLineCategories: ["INCOME"],
    minUserLines: 1,
    noControlRow: false,
  },
  BRV: {
    code: "BRV",
    name: "Bank Receipt Voucher",
    control: "BANK",
    controlSide: "debit",
    allowedLineCategories: ["INCOME", "ASSET", "LIABILITY", "EQUITY"],
    forbiddenLineControl: ["CASH", "BANK"],
    lineSide: "credit",
    forbiddenLineCategories: ["EXPENSE"],
    minUserLines: 1,
    noControlRow: false,
  },
  CPV: {
    code: "CPV",
    name: "Cash Payment Voucher",
    control: "CASH",
    controlSide: "credit",
    allowedLineCategories: ["EXPENSE", "ASSET", "LIABILITY"],
    forbiddenLineControl: ["CASH", "BANK"],
    lineSide: "debit",
    forbiddenLineCategories: ["INCOME"],
    minUserLines: 1,
    noControlRow: false,
  },
  CRV: {
    code: "CRV",
    name: "Cash Receipt Voucher",
    control: "CASH",
    controlSide: "debit",
    allowedLineCategories: ["INCOME", "ASSET", "LIABILITY", "EQUITY"],
    forbiddenLineControl: ["CASH", "BANK"],
    lineSide: "credit",
    forbiddenLineCategories: ["EXPENSE"],
    minUserLines: 1,
    noControlRow: false,
  },
  JV: {
    code: "JV",
    name: "Journal Voucher",
    control: null,
    controlSide: null,
    allowedLineCategories: ["ASSET", "LIABILITY", "EXPENSE", "EQUITY", "INCOME"],
    forbiddenLineControl: ["CASH", "BANK", "AR", "AP"],
    lineSide: "both",
    forbiddenLineCategories: [],
    minUserLines: 2,
    noControlRow: true,
  },
};

export function getConfig(type: VoucherTypeCode): VoucherTypeConfig {
  return VOUCHER_CONFIG[type];
}

/** Whether account is allowed for primary (control) selection. */
export function allowedForPrimary(
  acc: AccountLike,
  type: VoucherTypeCode
): boolean {
  const cfg = getConfig(type);
  if (!cfg.control) return false;
  return getControlType(acc) === cfg.control;
}

/** Whether account is allowed for line selection (user lines). Hidden if not. */
export function allowedForLine(
  acc: AccountLike,
  type: VoucherTypeCode
): boolean {
  const cfg = getConfig(type);
  if (!isPostingAccount(acc)) return false;
  const ct = getControlType(acc);
  if (cfg.forbiddenLineControl.includes(ct)) return false;
  const cat = getAccountCategory(acc);
  if (cfg.forbiddenLineCategories.includes(cat)) return false;
  return cfg.allowedLineCategories.includes(cat);
}

/** Control-type tag for UI. */
export function controlTag(ct: ControlType): string {
  if (ct === "NONE") return "";
  return `[${ct}]`;
}
