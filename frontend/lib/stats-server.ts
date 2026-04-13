/**
 * stats-server.ts
 *
 * Server-side data fetching helpers for the dashboard.
 * Token is read from the `token` cookie (set at login) — localStorage
 * is not available in Server Components / Route Handlers.
 */

import axios from 'axios';
import { cookies } from 'next/headers';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/+$/, '')          // strip trailing slash
  .replace(/\/api$/, '') + '/api'; // normalise to single /api suffix

async function getToken(): Promise<string | null> {
  // Server-side: read from cookie
  if (typeof window === 'undefined') {
    try {
      const cookieStore = await cookies();
      return cookieStore.get('token')?.value ?? null;
    } catch {
      return null;
    }
  }
  // Client-side fallback (shouldn't normally be reached from server helpers)
  return typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
}

async function apiCall<T = any>(endpoint: string): Promise<T | null> {
  const token = await getToken();

  if (!token) {
    console.warn(`[stats-server] No auth token available for ${endpoint} — skipping fetch`);
    return null;
  }

  try {
    const response = await axios.get<{ data: T }>(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15_000,
    });
    return response.data?.data ?? (response.data as any) ?? null;
  } catch (error: any) {
    const status = error?.response?.status;
    const msg = error?.response?.data?.message ?? error?.message ?? String(error);
    console.error(`[stats-server] Error fetching ${endpoint}: ${status ? `HTTP ${status} — ` : ''}${msg}`);
    return null;
  }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function getPropertiesStatsServer() {
  return apiCall('/stats/properties');
}

export async function getHRStatsServer() {
  return apiCall('/stats/hr');
}

export async function getCRMStatsServer() {
  return apiCall('/stats/crm');
}

export async function getFinanceStatsServer() {
  return apiCall('/stats/finance');
}

export async function getRevenueVsExpenseServer(monthsCount = 12) {
  return apiCall(`/stats/finance/revenue-vs-expense?months=${monthsCount}`);
}

export async function getDashboardDataServer() {
  return apiCall('/stats/dashboard');
}

export async function getCRMPageStatsServer() {
  return apiCall('/stats/crm');
}

export async function getFinancePageStatsServer() {
  const [financeData, financeTrendData] = await Promise.all([
    getFinanceStatsServer(),
    getRevenueVsExpenseServer(6),
  ]);
  return { financeData, financeTrendData };
}

export async function getPropertiesDetailsServer(searchTerm?: string) {
  const token = await getToken();
  if (!token) return { properties: [], statsData: {} };

  const headers = { Authorization: `Bearer ${token}` };
  const propertiesEndpoint = searchTerm
    ? `/properties?search=${encodeURIComponent(searchTerm)}`
    : '/properties';

  try {
    const [propertiesRes, statsRes] = await Promise.all([
      axios.get(`${API_BASE_URL}${propertiesEndpoint}`, { headers, timeout: 15_000 }),
      axios.get(`${API_BASE_URL}/stats/properties`, { headers, timeout: 15_000 }),
    ]);
    return {
      properties: propertiesRes.data?.data ?? [],
      statsData: statsRes.data?.data ?? {},
    };
  } catch (error: any) {
    console.error('[stats-server] Error fetching properties details:', error?.message ?? String(error));
    return { properties: [], statsData: {} };
  }
}

export async function getTenantsDetailsServer() {
  return apiCall('/tenants');
}

export async function getSalesDetailsServer() {
  return apiCall('/sales');
}

export async function getEmployeesDetailsServer() {
  return apiCall('/employees');
}
