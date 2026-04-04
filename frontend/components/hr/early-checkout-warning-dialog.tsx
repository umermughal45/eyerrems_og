"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface EarlyCheckoutWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  onCancel: () => void
  workedHours: number
  minimumHours: number
  earlyCheckoutMinutes: number
  checkInTime: string
  loading?: boolean
}

export function EarlyCheckoutWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  workedHours,
  minimumHours,
  earlyCheckoutMinutes,
  checkInTime,
  loading = false,
}: EarlyCheckoutWarningDialogProps) {
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState("")

  const handleConfirm = () => {
    if (!reason.trim()) {
      setReasonError("Please provide a reason for early checkout")
      return
    }

    if (reason.trim().length < 10) {
      setReasonError("Reason must be at least 10 characters long")
      return
    }

    setReasonError("")
    onConfirm(reason.trim())
  }

  const handleCancel = () => {
    setReason("")
    setReasonError("")
    onCancel()
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const hoursWorked = workedHours.toFixed(2)
  const hoursShort = (minimumHours - workedHours).toFixed(2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <DialogTitle className="text-xl">Early Checkout Warning</DialogTitle>
              <DialogDescription className="text-base mt-1">
                You are attempting to check out before completing minimum duty time
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert variant="destructive" className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning-foreground font-medium">
              Early checkout detected: {earlyCheckoutMinutes} minutes before minimum duty time
            </AlertDescription>
          </Alert>

          {/* Time Summary Card */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Hours Worked</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{hoursWorked}</p>
              <p className="text-xs text-muted-foreground">hours</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="h-4 w-4 text-success" />
                <p className="text-xs text-muted-foreground">Required</p>
              </div>
              <p className="text-2xl font-bold text-success">{minimumHours}</p>
              <p className="text-xs text-muted-foreground">hours</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <XCircle className="h-4 w-4 text-destructive" />
                <p className="text-xs text-muted-foreground">Short By</p>
              </div>
              <p className="text-2xl font-bold text-destructive">{hoursShort}</p>
              <p className="text-xs text-muted-foreground">hours</p>
            </div>
          </div>

          {/* Time Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-background rounded border">
              <span className="text-muted-foreground">Check In Time:</span>
              <span className="font-semibold">{formatTime(checkInTime)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-background rounded border">
              <span className="text-muted-foreground">Current Time:</span>
              <span className="font-semibold">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-background rounded border">
              <span className="text-muted-foreground">Time Remaining:</span>
              <span className="font-semibold text-warning">
                {Math.floor(earlyCheckoutMinutes / 60)}h {earlyCheckoutMinutes % 60}m
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-base font-semibold">
              Reason for Early Checkout <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please provide a detailed reason for checking out early (e.g., medical emergency, family issue, approved leave, etc.)"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError("")
              }}
              rows={4}
              className={reasonError ? "border-destructive" : ""}
            />
            {reasonError && (
              <p className="text-sm text-destructive">{reasonError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters required. This reason will be recorded for HR review.
            </p>
          </div>

          {/* Important Notice */}
          <Alert className="bg-blue-50 dark:bg-[#0d212c]50 border-blue-200 dark:border-blue-800">
            <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100 text-sm">
              <strong>Important:</strong> Early checkouts may affect your attendance record and payroll calculations. 
              This will be flagged for HR review. Please ensure you have proper authorization if required.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1"
          >
            {loading ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Confirm Early Checkout
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
