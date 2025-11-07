"use client"

import * as React from "react"
import { ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"

const Chart = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
))
Chart.displayName = "Chart"

const ChartContainer = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<typeof ResponsiveContainer> & {
        config?: Record<string, any>
        children: React.ComponentProps<typeof ResponsiveContainer>["children"]
    }
>(({ id, className, children, config, ...props }, ref) => {
    return (
        <div ref={ref} className={cn("flex aspect-video justify-center text-xs", className)}>
            <ResponsiveContainer width="100%" height="100%" {...props}>
                {children}
            </ResponsiveContainer>
        </div>
    )
})
ChartContainer.displayName = "ChartContainer"

const ChartTooltip = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-lg border bg-background p-2 shadow-md",
            className
        )}
        {...props}
    />
))
ChartTooltip.displayName = "ChartTooltip"

const ChartTooltipContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        active?: boolean
        payload?: Array<any>
        label?: string
    }
>(({ active, payload, label, className, ...props }, ref) => {
    if (active && payload && payload.length) {
        return (
            <div ref={ref} className={cn("grid gap-2", className)} {...props}>
                {label && (
                    <div className="font-medium">{label}</div>
                )}
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="font-medium">{entry.name}:</span>
                        <span>{entry.value}</span>
                    </div>
                ))}
            </div>
        )
    }

    return null
})
ChartTooltipContent.displayName = "ChartTooltipContent"

export {
    Chart,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
}