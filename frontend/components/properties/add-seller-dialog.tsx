"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

const sellerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone is required"),
  cnic: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  tid: z.string().min(1, "TID is required"),
})

type SellerFormData = z.infer<typeof sellerSchema>

interface AddSellerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  seller?: any // For edit mode
}

export function AddSellerDialog({ open, onOpenChange, onSuccess, seller }: AddSellerDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<SellerFormData>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      status: "Active",
    },
  })

  // Reset form when dialog opens/closes or seller changes
  React.useEffect(() => {
    if (open) {
      if (seller) {
        // Edit mode
        setValue("fullName", seller.fullName || "")
        setValue("phone", seller.phone || "")
        setValue("cnic", seller.cnic || "")
        setValue("email", seller.email || "")
        setValue("address", seller.address || "")
        setValue("notes", seller.notes || "")
        setValue("status", seller.status || "Active")
        setValue("tid", seller.tid || "")
      } else {
        // Add mode
        reset({
          fullName: "",
          phone: "",
          cnic: "",
          email: "",
          address: "",
          notes: "",
          status: "Active",
          tid: "",
        })
      }
    }
  }, [open, seller, setValue, reset])

  const onSubmit = async (data: SellerFormData) => {
    try {
      setLoading(true)

      const payload = {
        ...data,
        email: data.email || null,
      }

      if (seller) {
        await apiService.sellers.update(seller.id, payload)
        toast({
          title: "Success",
          description: "Seller updated successfully",
        })
      } else {
        await apiService.sellers.create(payload)
        toast({
          title: "Success",
          description: "Seller added successfully",
        })
      }

      onSuccess()
    } catch (error: any) {
      console.error("Seller save error:", error)
      toast({
        title: "Error",
        description: error.response?.data?.message || error.response?.data?.error || "Failed to save seller",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{seller ? "Edit Seller" : "Add New Seller"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                {...register("fullName")}
                placeholder="Enter full name"
              />
              {errors.fullName && (
                <p className="text-sm text-red-600">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="Enter phone number"
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnic">CNIC/ID</Label>
              <Input
                id="cnic"
                {...register("cnic")}
                placeholder="Enter CNIC or ID number"
              />
              {errors.cnic && (
                <p className="text-sm text-red-600">{errors.cnic.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="Enter address"
            />
            {errors.address && (
              <p className="text-sm text-red-600">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as "Active" | "Inactive")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tid">TID *</Label>
              <Input
                id="tid"
                {...register("tid")}
                placeholder="Enter TID"
              />
              {errors.tid && (
                <p className="text-sm text-red-600">{errors.tid.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Enter any additional notes"
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {seller ? "Update Seller" : "Add Seller"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}