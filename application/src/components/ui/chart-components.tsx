"use client"

import * as React from "react"
import {
    Area,
    AreaChart as RechartsAreaChart,
    Bar,
    BarChart as RechartsBarChart,
    Line,
    LineChart as RechartsLineChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts"

const AreaChart = React.forwardRef<
    HTMLDivElement,
    {
        data: any[]
        config: Record<string, any>
        className?: string
    }
>(({ data, config, className }, ref) => {
    return (
        <div ref={ref} className={className}>
            <ResponsiveContainer width="100%" height={300}>
                <RechartsAreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                        <p className="font-medium">{`Fecha: ${label}`}</p>
                                        {payload.map((entry, index) => {
                                            // Get the label from config or use dataKey as fallback
                                            const configKey = Object.keys(config).find(key => key === entry.dataKey);
                                            const displayName = configKey ? config[configKey].label : entry.dataKey;
                                            return (
                                                <p key={index} style={{ color: entry.color }} className="text-sm">
                                                    {`${displayName}: ${entry.value?.toFixed ? entry.value.toFixed(1) : entry.value}%`}
                                                </p>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    {Object.entries(config).map(([key, item]: [string, any]) => (
                        <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stackId="1"
                            stroke={item.color}
                            fill={item.color}
                            fillOpacity={0.6}
                        />
                    ))}
                </RechartsAreaChart>
            </ResponsiveContainer>
        </div>
    )
})
AreaChart.displayName = "AreaChart"

const BarChart = React.forwardRef<
    HTMLDivElement,
    {
        data: any[]
        config: Record<string, any>
        className?: string
    }
>(({ data, config, className }, ref) => {
    return (
        <div ref={ref} className={className}>
            <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                        <p className="font-medium">{`${label}`}</p>
                                        {payload.map((entry, index) => {
                                            // Get the label from config or use dataKey as fallback
                                            const configKey = Object.keys(config).find(key => key === entry.dataKey);
                                            const displayName = configKey ? config[configKey].label : entry.dataKey;
                                            return (
                                                <p key={index} style={{ color: entry.color }} className="text-sm">
                                                    {`${displayName}: ${entry.value?.toLocaleString ? entry.value.toLocaleString() : entry.value}`}
                                                </p>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    {Object.entries(config).map(([key, item]: [string, any]) => (
                        <Bar
                            key={key}
                            dataKey={key}
                            fill={item.color}
                            radius={[4, 4, 0, 0]}
                        />
                    ))}
                </RechartsBarChart>
            </ResponsiveContainer>
        </div>
    )
})
BarChart.displayName = "BarChart"

const LineChart = React.forwardRef<
    HTMLDivElement,
    {
        data: any[]
        config: Record<string, any>
        className?: string
    }
>(({ data, config, className }, ref) => {
    return (
        <div ref={ref} className={className}>
            <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                        <p className="font-medium">{`Fecha: ${label}`}</p>
                                        {payload.map((entry, index) => {
                                            // Get the label from config or use dataKey as fallback
                                            const configKey = Object.keys(config).find(key => key === entry.dataKey);
                                            const displayName = configKey ? config[configKey].label : entry.dataKey;
                                            return (
                                                <p key={index} style={{ color: entry.color }} className="text-sm">
                                                    {`${displayName}: ${entry.value?.toFixed ? entry.value.toFixed(1) : entry.value}`}
                                                </p>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    {Object.entries(config).map(([key, item]: [string, any]) => (
                        <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={item.color}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    ))}
                </RechartsLineChart>
            </ResponsiveContainer>
        </div>
    )
})
LineChart.displayName = "LineChart"

export { AreaChart, BarChart, LineChart }