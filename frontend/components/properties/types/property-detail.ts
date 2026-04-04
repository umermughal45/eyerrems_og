// TypeScript interfaces for Property Detail Modal

export interface PropertyDetail {
  id: string | number
  type: string
  status: string
  yearBuilt?: number
  totalArea?: number
  salesPrice?: number
  units: number
  address: string
  dealer: string
  owner: string
  ownerContact: string
  manualId?: string
  finance: FinanceSummary
  runningDeals: RunningDeal[]
  dealerLedger: DealerLedgerEntry[]
}

export interface FinanceSummary {
  totalReceived: number
  totalExpenses: number
  pendingAmount: number
  entries: number
  totalDue?: number
  totalOutstanding?: number
}

export interface RunningDeal {
  id: string | number
  title: string
  client: string
  amount: number
  received: number
  pending: number
  stage: string
}

export interface DealerLedgerEntry {
  id: string | number
  date: string | Date
  description: string
  debit?: number
  credit?: number
  balance: number
}

export interface PropertyDetailResponse {
  id: string | number
  type: string
  status: string
  yearBuilt?: number
  totalArea?: number
  salesPrice?: number
  units: number
  address: string
  dealer: string
  owner: string
  ownerContact: string
  manualId?: string
  finance: FinanceSummary
  runningDeals: RunningDeal[]
  dealerLedger: DealerLedgerEntry[]
}