/**
 * Global Filter Schema
 * Backend-first contract used by ALL modules
 * Enforced via Zod validation - rejects unknown fields
 */
import { z } from 'zod';
/**
 * Global Filter Schema (Strict)
 * This is the ONLY filter contract allowed in the system
 */
export declare const globalFilterSchema: z.ZodObject<{
    identity: z.ZodDefault<z.ZodObject<{
        system_ids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        reference_codes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        tids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        system_ids: string[];
        reference_codes: string[];
        tids: string[];
    }, {
        system_ids?: string[] | undefined;
        reference_codes?: string[] | undefined;
        tids?: string[] | undefined;
    }>>;
    status: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    lifecycle: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    priority: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    stage: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    ownership: z.ZodDefault<z.ZodObject<{
        assigned_users: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        teams: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        departments: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        dealers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        agents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        created_by: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        approved_by: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        dealers: string[];
        assigned_users: string[];
        teams: string[];
        departments: string[];
        agents: string[];
        created_by: string[];
        approved_by: string[];
    }, {
        dealers?: string[] | undefined;
        assigned_users?: string[] | undefined;
        teams?: string[] | undefined;
        departments?: string[] | undefined;
        agents?: string[] | undefined;
        created_by?: string[] | undefined;
        approved_by?: string[] | undefined;
    }>>;
    date: z.ZodOptional<z.ZodObject<{
        field: z.ZodOptional<z.ZodEnum<["created_at", "updated_at", "approved_at", "posted_at", "date", "follow_up_date", "expected_close_date", "deal_date", "join_date"]>>;
        from: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        preset: z.ZodOptional<z.ZodEnum<["today", "last_7_days", "month_to_date", "quarter", "last_month", "this_year", "custom"]>>;
    }, "strip", z.ZodTypeAny, {
        field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
        from?: string | null | undefined;
        to?: string | null | undefined;
        preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
    }, {
        field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
        from?: string | null | undefined;
        to?: string | null | undefined;
        preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
    }>>;
    numeric_ranges: z.ZodOptional<z.ZodObject<{
        amount_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        amount_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        balance_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        balance_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        debit_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        debit_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        credit_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        credit_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        tax_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        tax_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        amount_min?: number | null | undefined;
        amount_max?: number | null | undefined;
        balance_min?: number | null | undefined;
        balance_max?: number | null | undefined;
        debit_min?: number | null | undefined;
        debit_max?: number | null | undefined;
        credit_min?: number | null | undefined;
        credit_max?: number | null | undefined;
        tax_min?: number | null | undefined;
        tax_max?: number | null | undefined;
    }, {
        amount_min?: number | null | undefined;
        amount_max?: number | null | undefined;
        balance_min?: number | null | undefined;
        balance_max?: number | null | undefined;
        debit_min?: number | null | undefined;
        debit_max?: number | null | undefined;
        credit_min?: number | null | undefined;
        credit_max?: number | null | undefined;
        tax_min?: number | null | undefined;
        tax_max?: number | null | undefined;
    }>>;
    relationships: z.ZodDefault<z.ZodObject<{
        has_related: z.ZodDefault<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            id: string;
        }, {
            type: string;
            id: string;
        }>, "many">>;
        missing_related: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        has_related: {
            type: string;
            id: string;
        }[];
        missing_related: string[];
    }, {
        has_related?: {
            type: string;
            id: string;
        }[] | undefined;
        missing_related?: string[] | undefined;
    }>>;
    pagination: z.ZodDefault<z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
    }, {
        limit?: number | undefined;
        page?: number | undefined;
    }>>;
    sorting: z.ZodDefault<z.ZodObject<{
        field: z.ZodDefault<z.ZodString>;
        direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        direction: "asc" | "desc";
    }, {
        field?: string | undefined;
        direction?: "asc" | "desc" | undefined;
    }>>;
    search: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: string[];
    priority: string[];
    pagination: {
        limit: number;
        page: number;
    };
    stage: string[];
    lifecycle: string[];
    identity: {
        system_ids: string[];
        reference_codes: string[];
        tids: string[];
    };
    ownership: {
        dealers: string[];
        assigned_users: string[];
        teams: string[];
        departments: string[];
        agents: string[];
        created_by: string[];
        approved_by: string[];
    };
    relationships: {
        has_related: {
            type: string;
            id: string;
        }[];
        missing_related: string[];
    };
    sorting: {
        field: string;
        direction: "asc" | "desc";
    };
    search?: string | undefined;
    date?: {
        field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
        from?: string | null | undefined;
        to?: string | null | undefined;
        preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
    } | undefined;
    numeric_ranges?: {
        amount_min?: number | null | undefined;
        amount_max?: number | null | undefined;
        balance_min?: number | null | undefined;
        balance_max?: number | null | undefined;
        debit_min?: number | null | undefined;
        debit_max?: number | null | undefined;
        credit_min?: number | null | undefined;
        credit_max?: number | null | undefined;
        tax_min?: number | null | undefined;
        tax_max?: number | null | undefined;
    } | undefined;
}, {
    status?: string[] | undefined;
    search?: string | undefined;
    date?: {
        field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
        from?: string | null | undefined;
        to?: string | null | undefined;
        preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
    } | undefined;
    priority?: string[] | undefined;
    pagination?: {
        limit?: number | undefined;
        page?: number | undefined;
    } | undefined;
    stage?: string[] | undefined;
    lifecycle?: string[] | undefined;
    identity?: {
        system_ids?: string[] | undefined;
        reference_codes?: string[] | undefined;
        tids?: string[] | undefined;
    } | undefined;
    ownership?: {
        dealers?: string[] | undefined;
        assigned_users?: string[] | undefined;
        teams?: string[] | undefined;
        departments?: string[] | undefined;
        agents?: string[] | undefined;
        created_by?: string[] | undefined;
        approved_by?: string[] | undefined;
    } | undefined;
    numeric_ranges?: {
        amount_min?: number | null | undefined;
        amount_max?: number | null | undefined;
        balance_min?: number | null | undefined;
        balance_max?: number | null | undefined;
        debit_min?: number | null | undefined;
        debit_max?: number | null | undefined;
        credit_min?: number | null | undefined;
        credit_max?: number | null | undefined;
        tax_min?: number | null | undefined;
        tax_max?: number | null | undefined;
    } | undefined;
    relationships?: {
        has_related?: {
            type: string;
            id: string;
        }[] | undefined;
        missing_related?: string[] | undefined;
    } | undefined;
    sorting?: {
        field?: string | undefined;
        direction?: "asc" | "desc" | undefined;
    } | undefined;
}>;
export type GlobalFilterPayload = z.infer<typeof globalFilterSchema>;
/**
 * Validate and normalize filter payload
 * Rejects unknown fields, applies defaults
 */
export declare function validateGlobalFilter(input: unknown): GlobalFilterPayload;
/**
 * Export Request Schema (includes filter + export options)
 */
export declare const exportRequestSchema: z.ZodObject<{
    module: z.ZodString;
    tab: z.ZodOptional<z.ZodString>;
    format: z.ZodEnum<["csv", "excel", "pdf", "word"]>;
    scope: z.ZodEnum<["current_page", "all_filtered", "custom_limit"]>;
    custom_limit: z.ZodOptional<z.ZodNumber>;
    columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    data_shape: z.ZodDefault<z.ZodEnum<["raw", "grouped", "aggregated"]>>;
    filter: z.ZodObject<{
        identity: z.ZodDefault<z.ZodObject<{
            system_ids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            reference_codes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            tids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            system_ids: string[];
            reference_codes: string[];
            tids: string[];
        }, {
            system_ids?: string[] | undefined;
            reference_codes?: string[] | undefined;
            tids?: string[] | undefined;
        }>>;
        status: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        lifecycle: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        priority: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        stage: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        ownership: z.ZodDefault<z.ZodObject<{
            assigned_users: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            teams: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            departments: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            dealers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            agents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            created_by: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            approved_by: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            dealers: string[];
            assigned_users: string[];
            teams: string[];
            departments: string[];
            agents: string[];
            created_by: string[];
            approved_by: string[];
        }, {
            dealers?: string[] | undefined;
            assigned_users?: string[] | undefined;
            teams?: string[] | undefined;
            departments?: string[] | undefined;
            agents?: string[] | undefined;
            created_by?: string[] | undefined;
            approved_by?: string[] | undefined;
        }>>;
        date: z.ZodOptional<z.ZodObject<{
            field: z.ZodOptional<z.ZodEnum<["created_at", "updated_at", "approved_at", "posted_at", "date", "follow_up_date", "expected_close_date", "deal_date", "join_date"]>>;
            from: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            preset: z.ZodOptional<z.ZodEnum<["today", "last_7_days", "month_to_date", "quarter", "last_month", "this_year", "custom"]>>;
        }, "strip", z.ZodTypeAny, {
            field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
            from?: string | null | undefined;
            to?: string | null | undefined;
            preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
        }, {
            field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
            from?: string | null | undefined;
            to?: string | null | undefined;
            preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
        }>>;
        numeric_ranges: z.ZodOptional<z.ZodObject<{
            amount_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            amount_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            balance_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            balance_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            debit_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            debit_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            credit_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            credit_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            tax_min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            tax_max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            amount_min?: number | null | undefined;
            amount_max?: number | null | undefined;
            balance_min?: number | null | undefined;
            balance_max?: number | null | undefined;
            debit_min?: number | null | undefined;
            debit_max?: number | null | undefined;
            credit_min?: number | null | undefined;
            credit_max?: number | null | undefined;
            tax_min?: number | null | undefined;
            tax_max?: number | null | undefined;
        }, {
            amount_min?: number | null | undefined;
            amount_max?: number | null | undefined;
            balance_min?: number | null | undefined;
            balance_max?: number | null | undefined;
            debit_min?: number | null | undefined;
            debit_max?: number | null | undefined;
            credit_min?: number | null | undefined;
            credit_max?: number | null | undefined;
            tax_min?: number | null | undefined;
            tax_max?: number | null | undefined;
        }>>;
        relationships: z.ZodDefault<z.ZodObject<{
            has_related: z.ZodDefault<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                id: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: string;
                id: string;
            }, {
                type: string;
                id: string;
            }>, "many">>;
            missing_related: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            has_related: {
                type: string;
                id: string;
            }[];
            missing_related: string[];
        }, {
            has_related?: {
                type: string;
                id: string;
            }[] | undefined;
            missing_related?: string[] | undefined;
        }>>;
        pagination: z.ZodDefault<z.ZodObject<{
            page: z.ZodDefault<z.ZodNumber>;
            limit: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            limit: number;
            page: number;
        }, {
            limit?: number | undefined;
            page?: number | undefined;
        }>>;
        sorting: z.ZodDefault<z.ZodObject<{
            field: z.ZodDefault<z.ZodString>;
            direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            direction: "asc" | "desc";
        }, {
            field?: string | undefined;
            direction?: "asc" | "desc" | undefined;
        }>>;
        search: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        status: string[];
        priority: string[];
        pagination: {
            limit: number;
            page: number;
        };
        stage: string[];
        lifecycle: string[];
        identity: {
            system_ids: string[];
            reference_codes: string[];
            tids: string[];
        };
        ownership: {
            dealers: string[];
            assigned_users: string[];
            teams: string[];
            departments: string[];
            agents: string[];
            created_by: string[];
            approved_by: string[];
        };
        relationships: {
            has_related: {
                type: string;
                id: string;
            }[];
            missing_related: string[];
        };
        sorting: {
            field: string;
            direction: "asc" | "desc";
        };
        search?: string | undefined;
        date?: {
            field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
            from?: string | null | undefined;
            to?: string | null | undefined;
            preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
        } | undefined;
        numeric_ranges?: {
            amount_min?: number | null | undefined;
            amount_max?: number | null | undefined;
            balance_min?: number | null | undefined;
            balance_max?: number | null | undefined;
            debit_min?: number | null | undefined;
            debit_max?: number | null | undefined;
            credit_min?: number | null | undefined;
            credit_max?: number | null | undefined;
            tax_min?: number | null | undefined;
            tax_max?: number | null | undefined;
        } | undefined;
    }, {
        status?: string[] | undefined;
        search?: string | undefined;
        date?: {
            field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
            from?: string | null | undefined;
            to?: string | null | undefined;
            preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
        } | undefined;
        priority?: string[] | undefined;
        pagination?: {
            limit?: number | undefined;
            page?: number | undefined;
        } | undefined;
        stage?: string[] | undefined;
        lifecycle?: string[] | undefined;
        identity?: {
            system_ids?: string[] | undefined;
            reference_codes?: string[] | undefined;
            tids?: string[] | undefined;
        } | undefined;
        ownership?: {
            dealers?: string[] | undefined;
            assigned_users?: string[] | undefined;
            teams?: string[] | undefined;
            departments?: string[] | undefined;
            agents?: string[] | undefined;
            created_by?: string[] | undefined;
            approved_by?: string[] | undefined;
        } | undefined;
        numeric_ranges?: {
            amount_min?: number | null | undefined;
            amount_max?: number | null | undefined;
            balance_min?: number | null | undefined;
            balance_max?: number | null | undefined;
            debit_min?: number | null | undefined;
            debit_max?: number | null | undefined;
            credit_min?: number | null | undefined;
            credit_max?: number | null | undefined;
            tax_min?: number | null | undefined;
            tax_max?: number | null | undefined;
        } | undefined;
        relationships?: {
            has_related?: {
                type: string;
                id: string;
            }[] | undefined;
            missing_related?: string[] | undefined;
        } | undefined;
        sorting?: {
            field?: string | undefined;
            direction?: "asc" | "desc" | undefined;
        } | undefined;
    }>;
    preset_name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    format: "pdf" | "csv" | "excel" | "word";
    filter: {
        status: string[];
        priority: string[];
        pagination: {
            limit: number;
            page: number;
        };
        stage: string[];
        lifecycle: string[];
        identity: {
            system_ids: string[];
            reference_codes: string[];
            tids: string[];
        };
        ownership: {
            dealers: string[];
            assigned_users: string[];
            teams: string[];
            departments: string[];
            agents: string[];
            created_by: string[];
            approved_by: string[];
        };
        relationships: {
            has_related: {
                type: string;
                id: string;
            }[];
            missing_related: string[];
        };
        sorting: {
            field: string;
            direction: "asc" | "desc";
        };
        search?: string | undefined;
        date?: {
            field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
            from?: string | null | undefined;
            to?: string | null | undefined;
            preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
        } | undefined;
        numeric_ranges?: {
            amount_min?: number | null | undefined;
            amount_max?: number | null | undefined;
            balance_min?: number | null | undefined;
            balance_max?: number | null | undefined;
            debit_min?: number | null | undefined;
            debit_max?: number | null | undefined;
            credit_min?: number | null | undefined;
            credit_max?: number | null | undefined;
            tax_min?: number | null | undefined;
            tax_max?: number | null | undefined;
        } | undefined;
    };
    module: string;
    scope: "current_page" | "all_filtered" | "custom_limit";
    data_shape: "raw" | "grouped" | "aggregated";
    tab?: string | undefined;
    columns?: string[] | undefined;
    custom_limit?: number | undefined;
    preset_name?: string | undefined;
}, {
    format: "pdf" | "csv" | "excel" | "word";
    filter: {
        status?: string[] | undefined;
        search?: string | undefined;
        date?: {
            field?: "date" | "created_at" | "updated_at" | "approved_at" | "posted_at" | "follow_up_date" | "expected_close_date" | "deal_date" | "join_date" | undefined;
            from?: string | null | undefined;
            to?: string | null | undefined;
            preset?: "custom" | "today" | "last_7_days" | "month_to_date" | "quarter" | "last_month" | "this_year" | undefined;
        } | undefined;
        priority?: string[] | undefined;
        pagination?: {
            limit?: number | undefined;
            page?: number | undefined;
        } | undefined;
        stage?: string[] | undefined;
        lifecycle?: string[] | undefined;
        identity?: {
            system_ids?: string[] | undefined;
            reference_codes?: string[] | undefined;
            tids?: string[] | undefined;
        } | undefined;
        ownership?: {
            dealers?: string[] | undefined;
            assigned_users?: string[] | undefined;
            teams?: string[] | undefined;
            departments?: string[] | undefined;
            agents?: string[] | undefined;
            created_by?: string[] | undefined;
            approved_by?: string[] | undefined;
        } | undefined;
        numeric_ranges?: {
            amount_min?: number | null | undefined;
            amount_max?: number | null | undefined;
            balance_min?: number | null | undefined;
            balance_max?: number | null | undefined;
            debit_min?: number | null | undefined;
            debit_max?: number | null | undefined;
            credit_min?: number | null | undefined;
            credit_max?: number | null | undefined;
            tax_min?: number | null | undefined;
            tax_max?: number | null | undefined;
        } | undefined;
        relationships?: {
            has_related?: {
                type: string;
                id: string;
            }[] | undefined;
            missing_related?: string[] | undefined;
        } | undefined;
        sorting?: {
            field?: string | undefined;
            direction?: "asc" | "desc" | undefined;
        } | undefined;
    };
    module: string;
    scope: "current_page" | "all_filtered" | "custom_limit";
    tab?: string | undefined;
    columns?: string[] | undefined;
    custom_limit?: number | undefined;
    data_shape?: "raw" | "grouped" | "aggregated" | undefined;
    preset_name?: string | undefined;
}>;
export type ExportRequestPayload = z.infer<typeof exportRequestSchema>;
//# sourceMappingURL=global-filter-schema.d.ts.map