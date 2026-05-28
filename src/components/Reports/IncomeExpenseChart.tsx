"use client"

import React from "react"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts"
import { formatCurrency } from "@/lib/currency"

interface IncomeExpenseChartProps {
  data: any[]
}

export default function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
  }

  // Calculate totals for the summary header
  const totalIncome = data.reduce((sum, item) => sum + (item.income || 0), 0)
  const totalExpense = data.reduce((sum, item) => sum + (item.expense || 0), 0)

  return (
    <div className="w-full h-[400px] bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Income v Expense</h2>
          <p className="text-sm text-slate-500 mt-1">Compare your total cash inflow versus outflow.</p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Income</div>
            <div className="text-xl font-bold text-[#23B573]">{formatValue(totalIncome)}</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Expense</div>
            <div className="text-xl font-bold text-red-500">{formatValue(totalExpense)}</div>
          </div>
        </div>
      </div>
      
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
          >
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
              formatter={(value: any, name: any) => [formatValue(Number(value)), name === 'income' ? 'Income' : 'Expense']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              cursor={{ fill: '#f1f5f9' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="income" name="Income" fill="#23B573" radius={[4, 4, 0, 0]} animationDuration={1500} />
            <Bar dataKey="expense" name="Expense" fill="#E54545" radius={[4, 4, 0, 0]} animationDuration={1500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
