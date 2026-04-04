// Dealer Ledger Table Component
import React from 'react'
import { DealerLedgerEntry } from './types/property-detail'

interface DealerLedgerTableProps {
  dealerLedger: DealerLedgerEntry[]
  loading?: boolean
}

export function DealerLedgerTable({ dealerLedger, loading = false }: DealerLedgerTableProps) {
  const formatCurrency = (amount?: number) => {
    if (!amount || amount === 0) return 'Rs 0'
    return `Rs ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!dealerLedger || dealerLedger.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No dealer ledger entries found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="border border-gray-200 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="border border-gray-200 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Debit
            </th>
            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Credit
            </th>
            <th className="border border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Balance
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dealerLedger.map((entry, index) => (
            <tr key={entry.id || index} className="hover:bg-gray-50">
              <td className="border border-gray-200 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {formatDate(entry.date)}
              </td>
              <td className="border border-gray-200 px-4 py-3 text-sm text-gray-900">
                {entry.description || '-'}
              </td>
              <td className="border border-gray-200 px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">
                {entry.debit ? formatCurrency(entry.debit) : '-'}
              </td>
              <td className="border border-gray-200 px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                {entry.credit ? formatCurrency(entry.credit) : '-'}
              </td>
              <td className="border border-gray-200 px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                {formatCurrency(entry.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
