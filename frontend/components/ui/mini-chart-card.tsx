"use client"

import React, { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    YAxis,
} from "recharts"

type ChartType = "line" | "bar" | "area" | "pie" | "donut"

export interface MiniChartCardProps {
    title: string
    value?: string | number
    trend?: {
        value: number
        label?: string
    }
    data: any[]
    dataKey: string
    nameKey?: string // For Pie/Donut charts
    chartType: ChartType
    colors?: string[] // e.g., ['#8b5cf6', '#3b82f6']
    loading?: boolean
    className?: string
    valuePrefix?: string
    valueSuffix?: string
    height?: number
    hideValue?: boolean
}

const defaultColors = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"]

export function MiniChartCard({
    title,
    value,
    trend,
    data,
    dataKey,
    nameKey = "name",
    chartType,
    colors = defaultColors,
    loading = false,
    className,
    valuePrefix = "",
    valueSuffix = "",
    height = 80,
    hideValue = false,
}: MiniChartCardProps) {
    const chartColor = colors[0]

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-lg border bg-background/95 p-2 shadow-md backdrop-blur-sm dark:bg-zinc-950/95">
                    {label && <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>}
                    <div className="flex items-center gap-2">
                        <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: payload[0].color || chartColor }}
                        />
                        <span className="text-xs font-bold text-foreground">
                            {chartType === "pie" || chartType === "donut" ? payload[0].name : `${valuePrefix}${payload[0].value}${valueSuffix}`}
                        </span>
                        {(chartType === "pie" || chartType === "donut") && (
                            <span className="text-xs text-muted-foreground">
                                {`${valuePrefix}${payload[0].value}${valueSuffix}`}
                            </span>
                        )}
                    </div>
                </div>
            )
        }
        return null
    }

    const renderChart = () => {
        if (loading) {
            return (
                <div
                    className="flex items-center justify-center text-muted-foreground"
                    style={{ height }}
                >
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            )
        }

        if (!data || data.length === 0) {
            return (
                <div
                    className="flex items-center justify-center text-xs text-muted-foreground"
                    style={{ height }}
                >
                    No data
                </div>
            )
        }

        const commonProps = {
            data,
            margin: { top: 5, right: 0, left: 0, bottom: 5 },
        }

        switch (chartType) {
            case "line":
                return (
                    <ResponsiveContainer width="100%" height={height}>
                        <LineChart {...commonProps}>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" }} />
                            <YAxis domain={['dataMin', 'dataMax']} hide />
                            <Line
                                type="monotone"
                                dataKey={dataKey}
                                stroke={chartColor}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: chartColor }}
                                animationDuration={1500}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )
            case "bar":
                return (
                    <ResponsiveContainer width="100%" height={height}>
                        <BarChart {...commonProps}>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                            <Bar
                                dataKey={dataKey}
                                fill={chartColor}
                                radius={[4, 4, 0, 0]}
                                animationDuration={1500}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )
            case "area":
                return (
                    <ResponsiveContainer width="100%" height={height}>
                        <AreaChart {...commonProps}>
                            <defs>
                                <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" }} />
                            <YAxis domain={['dataMin', 'dataMax']} hide />
                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={chartColor}
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill={`url(#color-${dataKey})`}
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )
            case "pie":
            case "donut":
                const innerRadius = chartType === "donut" ? "60%" : 0
                return (
                    <ResponsiveContainer width="100%" height={height}>
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} />
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={innerRadius}
                                outerRadius="90%"
                                paddingAngle={chartType === "donut" ? 2 : 0}
                                dataKey={dataKey}
                                nameKey={nameKey}
                                stroke="var(--background)"
                                strokeWidth={2}
                                animationDuration={1500}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                )
            default:
                return null
        }
    }

    const isPositive = trend && trend.value > 0
    const isNegative = trend && trend.value < 0
    const isNeutral = trend && trend.value === 0

    return (
        <Card className={cn(
            "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]",
            className
        )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</CardTitle>
                {trend && (
                    <div
                        className={cn(
                            "flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                            isPositive && "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 dark:ring-emerald-500/30",
                            isNegative && "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-900/40 dark:text-rose-400 dark:ring-rose-500/30",
                            isNeutral && "bg-slate-50 text-slate-600 ring-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
                        )}
                    >
                        {isPositive ? "+" : ""}
                        {trend.value}%
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {!hideValue && value !== undefined && (
                    <div className="mb-2 flex items-baseline gap-1">
                        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {valuePrefix}
                            {value}
                            {valueSuffix}
                        </span>
                        {trend?.label && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">vs {trend.label}</span>
                        )}
                    </div>
                )}
                <div className={cn("mt-4", hideValue && "mt-1")}>
                    {renderChart()}
                </div>
            </CardContent>
        </Card>
    )
}
