"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Building, User, DollarSign, Calendar, FileText, Phone, Mail, MapPin, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"

export default function SaleDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [saleDetails, setSaleDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchSaleDetails()
    }
  }, [params.id])

  const fetchSaleDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const response: any = await apiService.sales.getById(String(params.id))
      const saleData = response?.data?.data || response?.data
      
      if (saleData) {
        setSaleDetails({
          id: saleData.id,
          propertyName: saleData.property?.name || saleData.propertyName || "N/A",
          propertyType: saleData.property?.type || saleData.propertyType || "N/A",
          propertyAddress: saleData.property?.address || saleData.propertyAddress || "N/A",
          salePrice: saleData.saleValue || saleData.salePrice || 0,
          commission: saleData.commission || 0,
          commissionRate: saleData.commissionRate || 0,
          saleDate: saleData.saleDate || new Date().toISOString(),
          status: saleData.status || "Pending",
          profit: saleData.profit || (saleData.saleValue - (saleData.actualPropertyValue || 0)),
          actualPropertyValue: saleData.actualPropertyValue || saleData.property?.totalArea || 0,
          buyers: saleData.buyers || [],
          documents: saleData.documents || (Array.isArray(saleData.documents) ? saleData.documents : []),
          notes: saleData.notes || "",
        })
      } else {
        setError("Sale not found")
      }
    } catch (err: any) {
      console.error("Failed to fetch sale details:", err)
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch sale details")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !saleDetails) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center py-12 text-destructive">{error || "Sale not found"}</div>
        </div>
      </div>
    )
  }

  // Mock data structure for backward compatibility - now using real data
  const saleDetailsFormatted = {
    ...saleDetails,
    buyer: saleDetails.buyers && saleDetails.buyers.length > 0 ? saleDetails.buyers[0] : {
      name: "N/A",
      email: "",
      phone: "",
      address: "",
    },
    documents: Array.isArray(saleDetails.documents) ? saleDetails.documents : [],
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Sale Details</h1>
              <p className="text-muted-foreground">Complete information about this property sale</p>
            </div>
          </div>
          <Badge variant={saleDetailsFormatted.status === "Completed" || saleDetailsFormatted.status === "completed" ? "default" : "secondary"} className="text-lg px-4 py-2">
            {saleDetailsFormatted.status}
          </Badge>
        </div>

        {/* Property Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building className="h-5 w-5" />
            Property Information
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Property Name</p>
              <p className="text-lg font-medium text-foreground">{saleDetailsFormatted.propertyName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Property Type</p>
              <p className="text-lg font-medium text-foreground">{saleDetailsFormatted.propertyType}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Address</p>
              <p className="text-lg font-medium text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {saleDetailsFormatted.propertyAddress}
              </p>
            </div>
          </div>
        </Card>

        {/* Financial Details */}
        <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Details
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Actual Property Value</p>
              <p className="text-xl font-bold text-foreground">Rs {(saleDetailsFormatted.actualPropertyValue || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Sale Price</p>
              <p className="text-2xl font-bold text-foreground">Rs {saleDetailsFormatted.salePrice.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Profit</p>
              <p className="text-2xl font-bold text-green-600">Rs {(saleDetailsFormatted.profit || (saleDetailsFormatted.salePrice - (saleDetailsFormatted.actualPropertyValue || 0))).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Commission ({saleDetailsFormatted.commissionRate}%)</p>
              <p className="text-xl font-bold text-blue-600">Rs {saleDetailsFormatted.commission.toLocaleString("en-IN")}</p>
            </div>
            <div className="md:col-span-4">
              <p className="text-sm text-muted-foreground mb-1">Sale Date</p>
              <p className="text-lg font-medium text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(saleDetailsFormatted.saleDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>

        {/* Buyer & Seller Information */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Buyer Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Buyer Information
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Name</p>
                <p className="text-lg font-medium text-foreground">{saleDetailsFormatted.buyer.name || "N/A"}</p>
              </div>
              {saleDetailsFormatted.buyer.email && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {saleDetailsFormatted.buyer.email}
                  </p>
                </div>
              )}
              {saleDetailsFormatted.buyer.phone && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Phone</p>
                  <p className="text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {saleDetailsFormatted.buyer.phone}
                  </p>
                </div>
              )}
              {saleDetailsFormatted.buyer.address && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Address</p>
                  <p className="text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {saleDetailsFormatted.buyer.address}
                  </p>
                </div>
              )}
            </div>
          </Card>

        </div>

        {/* Documents */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </h2>
          <div className="space-y-3">
            {saleDetailsFormatted.documents && saleDetailsFormatted.documents.length > 0 ? (
              saleDetailsFormatted.documents.map((doc: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{typeof doc === 'string' ? doc : doc.name || doc}</p>
                      {doc.date && (
                        <p className="text-sm text-muted-foreground">{new Date(doc.date).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    const url = typeof doc === 'string' ? doc : doc.url || doc
                    if (url) window.open(url, '_blank')
                  }}>
                    {typeof doc === 'string' ? 'View' : 'Download'}
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No documents uploaded</p>
            )}
          </div>
          {saleDetailsFormatted.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-semibold text-foreground mb-2">Notes</p>
              <p className="text-sm text-muted-foreground">{saleDetailsFormatted.notes}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
