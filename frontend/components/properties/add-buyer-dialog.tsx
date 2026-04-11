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

const buyerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone is required"),
  cnic: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  preferredLocation: z.string().optional(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  interestedPropertyType: z.string().optional(),
  requirementNotes: z.string().optional(),
  status: z.enum(["New", "Contacted", "Interested", "Closed", "Lost"]).optional(),
  tid: z.string().min(1, "TID is required"),
})

type BuyerFormData = z.infer<typeof buyerSchema>

interface AddBuyerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  buyer?: any // For edit mode
}

export function AddBuyerDialog({ open, onOpenChange, onSuccess, buyer }: AddBuyerDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BuyerFormData>({
    resolver: zodResolver(buyerSchema),
    defaultValues: {
      status: "New",
    },
  })

  // Reset form when dialog opens/closes or buyer changes
  React.useEffect(() => {
    if (open) {
      if (buyer) {
        // Edit mode
        setValue("fullName", buyer.fullName || buyer.name || "")
        setValue("phone", buyer.phone || "")
        setValue("cnic", buyer.cnic || "")
        setValue("email", buyer.email || "")
        setValue("preferredLocation", buyer.preferredLocation || "")
        setValue("budgetMin", buyer.budgetMin || undefined)
        setValue("budgetMax", buyer.budgetMax || undefined)
        setValue("interestedPropertyType", buyer.interestedPropertyType || "")
        setValue("requirementNotes", buyer.requirementNotes || buyer.notes || "")
        setValue("status", buyer.status || "New")
        setValue("tid", buyer.tid || "")
      } else {
        // Add mode
        reset({
          fullName: "",
          phone: "",
          cnic: "",
          email: "",
          preferredLocation: "",
          budgetMin: undefined,
          budgetMax: undefined,
          interestedPropertyType: "",
          requirementNotes: "",
          status: "New",
          tid: "",
        })
      }
    }
  }, [open, buyer, setValue, reset])

  const onSubmit = async (data: BuyerFormData) => {
    try {
      setLoading(true)

      const payload = {
        ...data,
        email: data.email || null,
        budgetMin: data.budgetMin || null,
        budgetMax: data.budgetMax || null,
      }

      if (buyer) {
        await apiService.buyers.update(buyer.id, payload)
        toast({
          title: "Success",
          description: "Buyer updated successfully",
        })
      } else {
        await apiService.buyers.create(payload)
        toast({
          title: "Success",
          description: "Buyer added successfully",
        })
      }

      onSuccess()
    } catch (error: any) {
      console.error("Buyer save error:", error)
      toast({
        title: "Error",
        description: error.response?.data?.message || error.response?.data?.error || "Failed to save buyer",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{buyer ? "Edit Buyer" : "Add New Buyer"}</DialogTitle>
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
            <Label htmlFor="preferredLocation">Preferred Location</Label>
            <Input
              id="preferredLocation"
              {...register("preferredLocation")}
              placeholder="Enter preferred location"
            />
            {errors.preferredLocation && (
              <p className="text-sm text-red-600">{errors.preferredLocation.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budgetMin">Budget Min</Label>
              <Input
                id="budgetMin"
                type="number"
                {...register("budgetMin", { valueAsNumber: true })}
                placeholder="Minimum budget"
              />
              {errors.budgetMin && (
                <p className="text-sm text-red-600">{errors.budgetMin.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="budgetMax">Budget Max</Label>
              <Input
                id="budgetMax"
                type="number"
                {...register("budgetMax", { valueAsNumber: true })}
                placeholder="Maximum budget"
              />
              {errors.budgetMax && (
                <p className="text-sm text-red-600">{errors.budgetMax.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interestedPropertyType">Interested Property Type</Label>
              <Select
                value={watch("interestedPropertyType")}
                onValueChange={(value) => setValue("interestedPropertyType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="plot">Plot</SelectItem>
                  <SelectItem value="villa">Villa</SelectItem>
                </SelectContent>
              </Select>
              {errors.interestedPropertyType && (
                <p className="text-sm text-red-600">{errors.interestedPropertyType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as "New" | "Contacted" | "Interested" | "Closed" | "Lost")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="Interested">Interested</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirementNotes">Requirement Notes</Label>
            <Textarea
              id="requirementNotes"
              {...register("requirementNotes")}
              placeholder="Enter buyer's requirements and notes"
              rows={3}
            />
            {errors.requirementNotes && (
              <p className="text-sm text-red-600">{errors.requirementNotes.message}</p>
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
              {buyer ? "Update Buyer" : "Add Buyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
