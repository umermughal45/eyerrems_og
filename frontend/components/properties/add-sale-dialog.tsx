"use client"

import React, { useState, useEffect } from "react"
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
import { formatCurrency } from "@/lib/utils"

const saleSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  sellerId: z.string().min(1, "Seller is required"),
  buyerId: z.string().min(1, "Buyer is required"),
  salePrice: z.number().min(0, "Sale price must be positive"),
  commission: z.number().min(0).optional(),
  commissionPercentage: z.number().min(0).max(100).optional(),
  dealDate: z.string().min(1, "Deal date is required"),
  status: z.enum(["Pending", "Completed", "Cancelled"]).optional(),
  notes: z.string().optional(),
  tid: z.string().min(1, "TID is required"),
})

type SaleFormData = z.infer<typeof saleSchema>

interface AddSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  sale?: any // For edit mode
}

export function AddSaleDialog({ open, onOpenChange, onSuccess, sale }: AddSaleDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [buyers, setBuyers] = useState<any[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      status: "Pending",
    },
  })

  // Fetch data when dialog opens
  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open])

  // Reset form when dialog opens/closes or sale changes
  useEffect(() => {
    if (open) {
      if (sale) {
        // Edit mode
        setValue("propertyId", sale.propertyId || "")
        setValue("sellerId", sale.sellerId || "")
        setValue("buyerId", sale.buyerId || "")
        setValue("salePrice", sale.salePrice || 0)
        setValue("commission", sale.commission || undefined)
        setValue("commissionPercentage", sale.commissionPercentage || undefined)
        setValue("dealDate", sale.dealDate ? new Date(sale.dealDate).toISOString().split('T')[0] : "")
        setValue("status", sale.status || "Pending")
        setValue("notes", sale.notes || "")
        setValue("tid", sale.tid || "")
      } else {
        // Add mode
        reset({
          propertyId: "",
          sellerId: "",
          buyerId: "",
          salePrice: 0,
          commission: undefined,
          commissionPercentage: undefined,
          dealDate: "",
          status: "Pending",
          notes: "",
          tid: "",
        })
      }
    }
  }, [open, sale, setValue, reset])

  const fetchData = async () => {
    try {
      const [propertiesRes, sellersRes, buyersRes] = await Promise.all([
        apiService.properties.getAll(),
        apiService.sellers.getAll(),
        apiService.buyers.getAll(),
      ])

      setProperties(Array.isArray(propertiesRes.data?.data) ? propertiesRes.data.data : [])
      setSellers(Array.isArray(sellersRes.data?.data) ? sellersRes.data.data : [])
      setBuyers(Array.isArray(buyersRes.data?.data) ? buyersRes.data.data : [])
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Error",
        description: "Failed to load properties, sellers, and buyers",
        variant: "destructive",
      })
    }
  }

  const onSubmit = async (data: SaleFormData) => {
    try {
      setLoading(true)

      const payload = {
        ...data,
        dealDate: new Date(data.dealDate).toISOString(),
        commission: data.commission || null,
        commissionPercentage: data.commissionPercentage || null,
      }

      if (sale) {
        await apiService.sales.update(sale.id, payload)
        toast({
          title: "Success",
          description: "Sale updated successfully",
        })
      } else {
        await apiService.sales.create(payload)
        toast({
          title: "Success",
          description: "Sale added successfully",
        })
      }

      onSuccess()
    } catch (error: any) {
      console.error("Sale save error:", error)
      toast({
        title: "Error",
        description: error.response?.data?.message || error.response?.data?.error || "Failed to save sale",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateCommission = (salePrice: number, percentage: number) => {
    if (salePrice && percentage) {
      return (salePrice * percentage) / 100
    }
    return 0
  }

  const watchedSalePrice = watch("salePrice")
  const watchedCommissionPercentage = watch("commissionPercentage")

  // Auto-calculate commission when percentage changes
  useEffect(() => {
    if (watchedSalePrice && watchedCommissionPercentage) {
      const calculatedCommission = calculateCommission(watchedSalePrice, watchedCommissionPercentage)
      setValue("commission", calculatedCommission)
    }
  }, [watchedSalePrice, watchedCommissionPercentage, setValue])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sale ? "Edit Sale" : "Add New Sale"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property *</Label>
              <Select
                value={watch("propertyId")}
                onValueChange={(value) => setValue("propertyId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.title || property.address} - {formatCurrency(property.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.propertyId && (
                <p className="text-sm text-red-600">{errors.propertyId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellerId">Seller *</Label>
              <Select
                value={watch("sellerId")}
                onValueChange={(value) => setValue("sellerId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select seller" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.fullName} - {seller.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sellerId && (
                <p className="text-sm text-red-600">{errors.sellerId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyerId">Buyer *</Label>
              <Select
                value={watch("buyerId")}
                onValueChange={(value) => setValue("buyerId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select buyer" />
                </SelectTrigger>
                <SelectContent>
                  {buyers.map((buyer) => (
                    <SelectItem key={buyer.id} value={buyer.id}>
                      {buyer.fullName} - {buyer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.buyerId && (
                <p className="text-sm text-red-600">{errors.buyerId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dealDate">Deal Date *</Label>
              <Input
                id="dealDate"
                type="date"
                {...register("dealDate")}
              />
              {errors.dealDate && (
                <p className="text-sm text-red-600">{errors.dealDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salePrice">Sale Price *</Label>
              <Input
                id="salePrice"
                type="number"
                {...register("salePrice", { valueAsNumber: true })}
                placeholder="Enter sale price"
              />
              {errors.salePrice && (
                <p className="text-sm text-red-600">{errors.salePrice.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as "Pending" | "Completed" | "Cancelled")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commissionPercentage">Commission %</Label>
              <Input
                id="commissionPercentage"
                type="number"
                step="0.01"
                {...register("commissionPercentage", { valueAsNumber: true })}
                placeholder="Enter commission percentage"
              />
              {errors.commissionPercentage && (
                <p className="text-sm text-red-600">{errors.commissionPercentage.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="commission">Commission Amount</Label>
              <Input
                id="commission"
                type="number"
                {...register("commission", { valueAsNumber: true })}
                placeholder="Auto-calculated or enter manually"
              />
              {errors.commission && (
                <p className="text-sm text-red-600">{errors.commission.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Enter sale notes"
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
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
              {sale ? "Update Sale" : "Add Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
