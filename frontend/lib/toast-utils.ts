/**
 * Toast Utility Functions
 * Provides consistent toast notifications across the application
 */

import { toast } from '@/hooks/use-toast'

type ToastVariant = 'default' | 'destructive' | 'success'

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

/**
 * Show success toast (green, auto-dismiss after 4 seconds)
 */
export function showSuccessToast(title: string, description?: string) {
  toast({
    title,
    description,
    variant: 'success',
    duration: 4000,
  })
}

/**
 * Show error toast (red, auto-dismiss after 5 seconds or manual close)
 */
export function showErrorToast(title: string, description?: string | any) {
  // Ensure description is always a string
  let descriptionText: string | undefined = undefined
  
  if (description !== undefined && description !== null) {
    if (typeof description === 'string') {
      descriptionText = description
    } else if (typeof description === 'object') {
      // Handle error objects (Zod, API errors, etc.)
      if (Array.isArray(description)) {
        descriptionText = description
          .map((item: any) => {
            if (typeof item === 'string') return item
            if (item?.message) return item.message
            if (item?.path && item?.message) return `${item.path}: ${item.message}`
            return JSON.stringify(item)
          })
          .join(', ')
      } else {
        // Single error object
        if (description.message) {
          descriptionText = String(description.message)
        } else if (description.error) {
          descriptionText = String(description.error)
        } else {
          descriptionText = JSON.stringify(description)
        }
      }
    } else {
      descriptionText = String(description)
    }
  }
  
  toast({
    title,
    description: descriptionText,
    variant: 'destructive',
    duration: 5000,
  })
}

/**
 * Show info toast (default, auto-dismiss after 3 seconds)
 */
export function showInfoToast(title: string, description?: string) {
  toast({
    title,
    description,
    variant: 'default',
    duration: 3000,
  })
}

/**
 * Handle API response and show appropriate toast
 */
export function handleApiResponse(
  response: any,
  successMessage?: string,
  errorMessage?: string
) {
  if (response?.data?.success !== false && !response?.error) {
    const message = successMessage || response?.data?.message || 'Operation completed successfully'
    showSuccessToast('Success', String(message))
    return true
  } else {
    let error: string = errorMessage || 'An error occurred'
    
    // Handle Zod validation errors (array of error objects)
    if (response?.data?.error) {
      const apiError = response.data.error
      if (Array.isArray(apiError)) {
        error = apiError
          .map((err: any) => {
            if (typeof err === 'string') return err
            if (err?.message) return err.message
            if (err?.path) return `${err.path}: ${err.message || 'Invalid value'}`
            return JSON.stringify(err)
          })
          .join(', ')
      } else if (typeof apiError === 'object') {
        error = apiError.message || apiError.error || JSON.stringify(apiError)
      } else {
        error = String(apiError)
      }
    } else if (response?.data?.message) {
      error = String(response.data.message)
    } else if (response?.message) {
      error = String(response.message)
    }
    
    showErrorToast('Error', error)
    return false
  }
}

/**
 * Handle API error and show toast
 */
export function handleApiError(error: any, defaultMessage?: string) {
  let errorMessage: string = defaultMessage || 'An unexpected error occurred'
  
  // Handle Zod validation errors (array of error objects)
  if (error?.response?.data?.error) {
    const apiError = error.response.data.error
    if (Array.isArray(apiError)) {
      // Extract messages from Zod validation errors
      errorMessage = apiError
        .map((err: any) => {
          if (typeof err === 'string') return err
          if (err?.message) return err.message
          if (err?.path) return `${err.path}: ${err.message || 'Invalid value'}`
          return JSON.stringify(err)
        })
        .join(', ')
    } else if (typeof apiError === 'object') {
      // If it's an object, try to extract message or stringify
      errorMessage = apiError.message || apiError.error || JSON.stringify(apiError)
    } else {
      errorMessage = String(apiError)
    }
  } else if (error?.response?.data?.message) {
    errorMessage = String(error.response.data.message)
  } else if (error?.message) {
    errorMessage = String(error.message)
  }
  
  showErrorToast('Error', errorMessage)
}

/**
 * Property-specific toast messages
 */
export const PropertyToasts = {
  created: (name: string) => showSuccessToast('Property Added', `Property "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Property Updated', `Property "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Property Deleted', `Property "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Property Error', message || 'Failed to perform property operation'),
}

/**
 * Unit-specific toast messages
 */
export const UnitToasts = {
  created: (name: string) => showSuccessToast('Unit Added', `Unit "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Unit Updated', `Unit "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Unit Deleted', `Unit "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Unit Error', message || 'Failed to perform unit operation'),
}

/**
 * Floor-specific toast messages
 */
export const FloorToasts = {
  created: (name: string) => showSuccessToast('Floor Added', `Floor "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Floor Updated', `Floor "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Floor Deleted', `Floor "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Floor Error', message || 'Failed to perform floor operation'),
}

/**
 * Tenant-specific toast messages
 */
export const TenantToasts = {
  created: (name: string) => showSuccessToast('Tenant Added', `Tenant "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Tenant Updated', `Tenant "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Tenant Deleted', `Tenant "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Tenant Error', message || 'Failed to perform tenant operation'),
}

/**
 * Lease-specific toast messages
 */
export const LeaseToasts = {
  created: (number?: string) => showSuccessToast('Lease Created', `Lease ${number ? `"${number}"` : ''} has been created successfully`),
  updated: (number?: string) => showSuccessToast('Lease Updated', `Lease ${number ? `"${number}"` : ''} has been updated successfully`),
  deleted: (number?: string) => showSuccessToast('Lease Deleted', `Lease ${number ? `"${number}"` : ''} has been deleted successfully`),
  error: (message?: string) => showErrorToast('Lease Error', message || 'Failed to perform lease operation'),
}

/**
 * Invoice-specific toast messages
 */
export const InvoiceToasts = {
  created: (number: string) => showSuccessToast('Invoice Created', `Invoice "${number}" has been created successfully`),
  updated: (number: string) => showSuccessToast('Invoice Updated', `Invoice "${number}" has been updated successfully`),
  deleted: (number: string) => showSuccessToast('Invoice Deleted', `Invoice "${number}" has been deleted successfully`),
  paid: (number: string, amount?: number) => showSuccessToast('Payment Received', `Invoice "${number}" ${amount ? `paid (Rs ${amount.toLocaleString()})` : 'has been paid'}`),
  error: (message?: string) => showErrorToast('Invoice Error', message || 'Failed to perform invoice operation'),
}

/**
 * Payment-specific toast messages
 */
export const PaymentToasts = {
  received: (id: string, amount: number) => showSuccessToast('Payment Received', `Payment "${id}" of Rs ${amount.toLocaleString()} has been received`),
  updated: (id: string) => showSuccessToast('Payment Updated', `Payment "${id}" has been updated successfully`),
  deleted: (id: string) => showSuccessToast('Payment Deleted', `Payment "${id}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Payment Error', message || 'Failed to process payment'),
}

/**
 * Deal-specific toast messages
 */
export const DealToasts = {
  created: (title: string) => showSuccessToast('Deal Created', `Deal "${title}" has been created successfully`),
  updated: (title: string) => showSuccessToast('Deal Updated', `Deal "${title}" has been updated successfully`),
  deleted: (title: string) => showSuccessToast('Deal Deleted', `Deal "${title}" has been deleted successfully`),
  closed: (title: string) => showSuccessToast('Deal Closed', `Deal "${title}" has been closed successfully`),
  error: (message?: string) => showErrorToast('Deal Error', message || 'Failed to perform deal operation'),
}

/**
 * Payroll-specific toast messages
 */
export const PayrollToasts = {
  created: (employeeName: string, month: string) => showSuccessToast('Payroll Created', `Payroll for ${employeeName} (${month}) has been created successfully`),
  updated: (employeeName: string, month: string) => showSuccessToast('Payroll Updated', `Payroll for ${employeeName} (${month}) has been updated successfully`),
  paid: (employeeName: string, month: string) => showSuccessToast('Payroll Processed', `Payroll for ${employeeName} (${month}) has been processed successfully`),
  deleted: (employeeName: string, month: string) => showSuccessToast('Payroll Deleted', `Payroll for ${employeeName} (${month}) has been deleted successfully`),
  error: (message?: string) => showErrorToast('Payroll Error', message || 'Failed to perform payroll operation'),
}

/**
 * Attendance-specific toast messages
 */
export const AttendanceToasts = {
  checkedIn: (employeeName: string) => showSuccessToast('Checked In', `${employeeName} has checked in successfully`),
  checkedOut: (employeeName: string) => showSuccessToast('Checked Out', `${employeeName} has checked out successfully`),
  updated: (employeeName: string) => showSuccessToast('Attendance Updated', `Attendance for ${employeeName} has been updated successfully`),
  error: (message?: string) => showErrorToast('Attendance Error', message || 'Failed to perform attendance operation'),
}

/**
 * Maintenance-specific toast messages
 */
export const MaintenanceToasts = {
  created: (ticketNumber?: string) => showSuccessToast('Ticket Created', `Maintenance ticket ${ticketNumber ? `"${ticketNumber}"` : ''} has been created successfully`),
  updated: (ticketNumber?: string) => showSuccessToast('Ticket Updated', `Maintenance ticket ${ticketNumber ? `"${ticketNumber}"` : ''} has been updated successfully`),
  closed: (ticketNumber?: string) => showSuccessToast('Ticket Closed', `Maintenance ticket ${ticketNumber ? `"${ticketNumber}"` : ''} has been closed successfully`),
  error: (message?: string) => showErrorToast('Maintenance Error', message || 'Failed to perform maintenance operation'),
}

/**
 * Client/Lead-specific toast messages
 */
export const ClientToasts = {
  created: (name: string) => showSuccessToast('Client Added', `Client "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Client Updated', `Client "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Client Deleted', `Client "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Client Error', message || 'Failed to perform client operation'),
}

export const LeadToasts = {
  created: (name: string) => showSuccessToast('Lead Added', `Lead "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Lead Updated', `Lead "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Lead Deleted', `Lead "${name}" has been deleted successfully`),
  converted: (name: string) => showSuccessToast('Lead Converted', `Lead "${name}" has been converted to client successfully`),
  error: (message?: string) => showErrorToast('Lead Error', message || 'Failed to perform lead operation'),
}

/**
 * Auth-specific toast messages
 */
export const AuthToasts = {
  loginSuccess: () => showSuccessToast('Login Successful', 'Welcome back!'),
  loginError: (message?: string) => showErrorToast('Login Failed', message || 'Invalid email or password'),
  logoutSuccess: () => showSuccessToast('Logged Out', 'You have been logged out successfully'),
  logoutError: () => showErrorToast('Logout Error', 'Failed to log out'),
  sessionExpired: () => showErrorToast('Session Expired', 'Your session has expired. Please login again.'),
}

/**
 * Block-specific toast messages
 */
export const BlockToasts = {
  created: (name: string) => showSuccessToast('Block Added', `Block "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Block Updated', `Block "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Block Deleted', `Block "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Block Error', message || 'Failed to perform block operation'),
}

/**
 * Sale-specific toast messages
 */
export const SaleToasts = {
  created: (propertyName: string) => showSuccessToast('Sale Recorded', `Sale for "${propertyName}" has been recorded successfully`),
  updated: (propertyName: string) => showSuccessToast('Sale Updated', `Sale for "${propertyName}" has been updated successfully`),
  deleted: (propertyName: string) => showSuccessToast('Sale Deleted', `Sale for "${propertyName}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Sale Error', message || 'Failed to perform sale operation'),
}

/**
 * Transaction-specific toast messages
 */
export const TransactionToasts = {
  created: (code: string) => showSuccessToast('Transaction Created', `Transaction "${code}" has been created successfully`),
  updated: (code: string) => showSuccessToast('Transaction Updated', `Transaction "${code}" has been updated successfully`),
  deleted: (code: string) => showSuccessToast('Transaction Deleted', `Transaction "${code}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Transaction Error', message || 'Failed to perform transaction operation'),
}

/**
 * Account-specific toast messages
 */
export const AccountToasts = {
  created: (name: string) => showSuccessToast('Account Created', `Account "${name}" has been created successfully`),
  updated: (name: string) => showSuccessToast('Account Updated', `Account "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Account Deleted', `Account "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Account Error', message || 'Failed to perform account operation'),
}

/**
 * Voucher-specific toast messages
 */
export const VoucherToasts = {
  created: (number: string) => showSuccessToast('Voucher Created', `Voucher "${number}" has been created successfully`),
  updated: (number: string) => showSuccessToast('Voucher Updated', `Voucher "${number}" has been updated successfully`),
  deleted: (number: string) => showSuccessToast('Voucher Deleted', `Voucher "${number}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Voucher Error', message || 'Failed to perform voucher operation'),
}

/**
 * Dealer-specific toast messages
 */
export const DealerToasts = {
  created: (name: string) => showSuccessToast('Dealer Added', `Dealer "${name}" has been added successfully`),
  updated: (name: string) => showSuccessToast('Dealer Updated', `Dealer "${name}" has been updated successfully`),
  deleted: (name: string) => showSuccessToast('Dealer Deleted', `Dealer "${name}" has been deleted successfully`),
  error: (message?: string) => showErrorToast('Dealer Error', message || 'Failed to perform dealer operation'),
}

/**
 * Communication-specific toast messages
 */
export const CommunicationToasts = {
  created: () => showSuccessToast('Communication Logged', 'Communication has been logged successfully'),
  updated: () => showSuccessToast('Communication Updated', 'Communication has been updated successfully'),
  deleted: () => showSuccessToast('Communication Deleted', 'Communication has been deleted successfully'),
  error: (message?: string) => showErrorToast('Communication Error', message || 'Failed to perform communication operation'),
}

