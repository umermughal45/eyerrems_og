import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { useSettingsStore } from './store/settings-store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number | string | null | undefined, mode: 'full' | 'compact' = 'full'): string {
  if (value === null || value === undefined) return "0"
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(numValue)) return "0"

  if (mode === 'compact') {
    if (numValue >= 10000000) return `${(numValue / 10000000).toFixed(2)}Cr`
    if (numValue >= 100000) return `${(numValue / 100000).toFixed(2)}L`
    if (numValue >= 1000) return `${(numValue / 1000).toFixed(1)}k`
    return Math.round(numValue).toString()
  }

  return Math.round(numValue).toLocaleString("en-US")
}

export function formatCurrency(
  value: number | string | null | undefined, 
  symbol?: string, 
  mode?: 'full' | 'compact'
): string {
  let finalSymbol = symbol;
  let finalMode = mode;

  // Try to use global settings if not explicitly provided
  try {
    const store = useSettingsStore.getState();
    if (!finalSymbol) {
      finalSymbol = store.currencies.find(c => c.code === store.activeCurrency)?.symbol || 'Rs';
    }
    if (!finalMode) {
      finalMode = store.numberFormat;
    }
  } catch (e) {
    // Fallback if store is not accessible
    finalSymbol = finalSymbol || 'Rs';
    finalMode = finalMode || 'full';
  }

  const formattedNumber = formatNumber(value, finalMode);
  return `${finalSymbol} ${formattedNumber}`;
}

/**
 * Convert an amount from one currency to another using exchange rates.
 * exchangeRate is relative to the base currency (USD = 1.0).
 */
export function convertAmount(
  amount: number, 
  fromCode: string, 
  toCode: string, 
  currencies: Array<{ code: string, exchangeRate: number }>
): number {
  if (fromCode === toCode) return amount
  
  const fromCurrency = currencies.find(c => c.code === fromCode)
  const toCurrency = currencies.find(c => c.code === toCode)
  
  if (!fromCurrency || !toCurrency) return amount
  
  // Convert from input currency to base currency (USD) first
  // amount / rate = baseAmount (USD)
  const baseAmount = amount / fromCurrency.exchangeRate
  // Then convert from base to target currency
  // baseAmount * targetRate = targetAmount
  return baseAmount * toCurrency.exchangeRate
}

/**
 * Trigger a client-side JSON download for any data object.
 */
export function downloadJSON(data: unknown, filename: string) {
  const safeName = filename.endsWith('.json') ? filename : `${filename}.json`
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeName
  link.click()
  URL.revokeObjectURL(url)
}
