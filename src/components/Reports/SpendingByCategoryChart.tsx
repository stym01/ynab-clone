"use client"

import React from "react"
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts"
import { formatCurrency } from "@/lib/currency"

interface SpendingByCategoryChartProps {
  data: { name: string; total: number }[]
}

const COLORS = ['#003F5E', '#005A87', '#23B573', '#E8A317', '#E54545', '#8B5CF6', '#F97316', '#14B8A6', '#6366F1', '#EC4899']

export default function SpendingByCategoryChart({ data }: SpendingByCategoryChartProps) {
  // Sort data descending and format
  const sortedData = [...data].sort((a, b) => b.total - a.total)
  
  // Convert paise to actual value
  const chartData = sortedData.map(item => ({
    name: item.name,
    value: item.total / 100,
    rawTotal: item.total
  }))

  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200">
          <p className="font-semibold text-slate-700">{payload[0].name}</p>
          <p className="text-[#005A87] font-bold">
            {formatCurrency(payload[0].payload.rawTotal)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[400px] bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-slate-800">Spending by Category</h2>
        <p className="text-sm text-slate-500 mt-1">Breakdown of where your money goes.</p>
      </div>
      
      <div className="flex-1 w-full min-h-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                animationDuration={1000}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={renderCustomTooltip} />
              <Legend 
                verticalAlign="middle" 
                align="right" 
                layout="vertical"
                wrapperStyle={{ fontSize: '12px', color: '#64748b' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            No spending data available.
          </div>
        )}
      </div>
    </div>
  )
}
