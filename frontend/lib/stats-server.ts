import axios from 'axios';

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} minute ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hour ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} day ago`

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks} week ago`

  const diffInMonths = Math.floor(diffInDays / 30)
  return `${diffInMonths} month ago`
}

import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function apiCall(endpoint: string) {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    } catch (e) {
      // Handle the case where cookies() cannot be called
    }
  }

  try {
    const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(`[stats-server] Error fetching ${endpoint}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function getPropertiesStatsServer() {
  return await apiCall('/stats/properties');
}

export async function getHRStatsServer() {
  return await apiCall('/stats/hr');
}

export async function getCRMStatsServer() {
  return await apiCall('/stats/crm');
}

export async function getFinanceStatsServer() {
  return await apiCall('/stats/finance');
}

export async function getRevenueVsExpenseServer(monthsCount = 12) {
  return await apiCall(`/stats/finance/revenue-vs-expense?months=${monthsCount}`);
}

export async function getDashboardDataServer() {
  return await apiCall('/stats/dashboard');
}

export async function getCRMPageStatsServer() {
  return await apiCall('/stats/crm');
}

export async function getFinancePageStatsServer() {
  const [financeData, financeTrendData] = await Promise.all([
    getFinanceStatsServer(),
    getRevenueVsExpenseServer(6),
  ]);

  return {
    financeData,
    financeTrendData,
  };
}

export async function getPropertiesDetailsServer(searchTerm?: string) {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    } catch (e) {}
  }
  const endpoint = searchTerm
    ? `/properties?search=${searchTerm}`
    : '/properties';
  
  try {
    const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(`[stats-server] Error fetching ${endpoint}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getTenantsDetailsServer() {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    } catch (e) {}
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/tenants`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(`[stats-server] Error fetching /tenants:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getSalesDetailsServer() {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    } catch (e) {}
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/sales`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(`[stats-server] Error fetching /sales:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getEmployeesDetailsServer() {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    } catch (e) {}
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/employees`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(`[stats-server] Error fetching /employees:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
