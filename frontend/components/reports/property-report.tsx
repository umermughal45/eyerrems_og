import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

type PropertyReportProps = {
    property: {
        name?: string
        type?: string
        status?: string
        salePrice?: number | string
        address?: string
        totalArea?: string
        yearBuilt?: string | number
        floors?: any[]
        ownerName?: string
        ownerPhone?: string
        dealerName?: string
        dealerContact?: string
    }
    financeSummary?: {
        totalReceived?: number
        totalExpenses?: number
        pendingAmount?: number
        entries?: number
    }
}

export function PropertyReport({ property, financeSummary = {} }: PropertyReportProps) {
    // Helpers
    const getValue = (val: any) => (val ? val : "N/A")

    return (
        <div className="p-6 bg-gray-100 min-h-screen print:bg-white print:p-0 print:min-h-0">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 print:text-black">Property Management Report</h1>

            <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2 print:gap-4">
                {/* Client Block */}
                <Card className="bg-white shadow-md print:shadow-none print:border">
                    <CardHeader>
                        <CardTitle className="text-blue-600 print:text-black">Client</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Client Name:</span>
                            <span className="font-semibold">{getValue(property.ownerName)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Contact:</span>
                            <span className="font-semibold">{getValue(property.ownerPhone)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Deals:</span>
                            <span className="font-semibold">{getValue(financeSummary.entries)} active deal(s)</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Properties Block */}
                <Card className="bg-white shadow-md print:shadow-none print:border">
                    <CardHeader>
                        <CardTitle className="text-blue-600 print:text-black">Properties</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Property Name:</span>
                            <span className="font-semibold">{getValue(property.name)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Type:</span>
                            <span className="font-semibold">{getValue(property.type)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Status:</span>
                            <span className="font-semibold">{getValue(property.status)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Sales Price:</span>
                            <span className="font-semibold">
                                {property.salePrice ? formatCurrency(Number(property.salePrice)) : "N/A"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Address:</span>
                            <span className="font-semibold text-right max-w-[200px]">{getValue(property.address)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Floors:</span>
                            <span className="font-semibold">
                                {Array.isArray(property.floors) && property.floors.length > 0 ? `${property.floors.length}` : "1 (Ground Floor)"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Total Area:</span>
                            <span className="font-semibold">{getValue(property.totalArea)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Year Built:</span>
                            <span className="font-semibold">{getValue(property.yearBuilt)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Finance Block */}
                <Card className="bg-white shadow-md print:shadow-none print:border">
                    <CardHeader>
                        <CardTitle className="text-blue-600 print:text-black">Finance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Total Received:</span>
                            <span className="font-semibold">{formatCurrency(financeSummary.totalReceived || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Pending Amount:</span>
                            <span className="font-semibold">{formatCurrency(financeSummary.pendingAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Total Expenses:</span>
                            <span className="font-semibold">{formatCurrency(financeSummary.totalExpenses || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Income (Last 12 Months):</span>
                            <span className="font-semibold">Rs 0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Average / Month:</span>
                            <span className="font-semibold">Rs 0</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Dealer Block */}
                <Card className="bg-white shadow-md print:shadow-none print:border">
                    <CardHeader>
                        <CardTitle className="text-blue-600 print:text-black">Dealer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Dealer Name:</span>
                            <span className="font-semibold">{getValue(property.dealerName)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Deals Assigned:</span>
                            <span className="font-semibold">N/A</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Contact:</span>
                            <span className="font-semibold">{getValue(property.dealerContact)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 print:text-gray-700">Active Deals:</span>
                            <span className="font-semibold">
                                {financeSummary.entries ?? 0} ({property.name}, {property.salePrice ? formatCurrency(Number(property.salePrice)) : "N/A"})
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
