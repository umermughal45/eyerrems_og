import axios from 'axios';

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return ${diffInMinutes} minute ago

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return ${diffInHours} hour ago

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return ${diffInDays} day ago

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return ${diffInWeeks} week ago

  const diffInMonths = Math.floor(diffInDays / 30)
  return ${diffInMonths} month ago
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function apiCall(endpoint: string) {
  const token = localStorage.getItem('token');
  const response = await axios.get(${API_BASE_URL}, {
    headers: {
      Authorization: Bearer ,
    },
  });
  return response.data.data;
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
  return await apiCall(/stats/finance/revenue-vs-expense?months=);
}

export async function getDashboardDataServer() {
  return await apiCall('/stats/dashboard');
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
  const endpoint = searchTerm
    ? /properties?search=
    : '/properties';
  const response = await axios.get(${API_BASE_URL}, {
    headers: {
      Authorization: Bearer ,
    },
  });
  return response.data.data;
}

export async function getTenantsDetailsServer() {
  const response = await axios.get(${API_BASE_URL}/tenants, {
    headers: {
      Authorization: Bearer ,
    },
  });
  return response.data.data;
}

export async function getSalesDetailsServer() {
  const response = await axios.get(${API_BASE_URL}/sales, {
    headers: {
      Authorization: Bearer ,
    },
  });
  return response.data.data;
}

export async function getEmployeesDetailsServer() {
  const response = await axios.get(${API_BASE_URL}/employees, {
    headers: {
      Authorization: Bearer ,
    },
  });
  return response.data.data;
}
