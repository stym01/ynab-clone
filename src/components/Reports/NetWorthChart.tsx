"use client"

import React from "react"
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts"

interface NetWorthChartProps {
  data: any[]
}

export default function NetWorthChart({ data }: NetWorthChartProps) {
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
  }

  return (
    <div className="w-full h-[400px] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Net Worth</h2>
          <p className="text-sm text-slate-500 mt-1">Your total assets minus total debts over time.</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Current Net Worth</div>
          <div className="text-3xl font-bold text-[#23B573]">
            {data.length > 0 ? formatValue(data[data.length - 1].netWorth) : "₹0"}
          </div>
        </div>
      </div>
      
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#23B573" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#23B573" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              dx={-10}
            />
            <Tooltip 
              formatter={(value: any) => [formatValue(Number(value)), "Net Worth"]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area 
              type="monotone" 
              dataKey="netWorth" 
              stroke="#23B573" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorNetWorth)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
