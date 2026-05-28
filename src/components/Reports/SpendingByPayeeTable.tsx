"use client"

import React from "react"
import { formatCurrency } from "@/lib/currency"

interface SpendingByPayeeTableProps {
  data: { name: string; total: number }[]
}

export default function SpendingByPayeeTable({ data }: SpendingByPayeeTableProps) {
  const sortedData = [...data].sort((a, b) => b.total - a.total)
  
  return (
    <div className="w-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">Spending by Payee</h2>
        <p className="text-sm text-slate-500 mt-1">Your top payees by total outflow.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2">
        {sortedData.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="py-2 font-semibold text-slate-500 text-sm uppercase tracking-wider">Payee</th>
                <th className="py-2 font-semibold text-slate-500 text-sm uppercase tracking-wider text-right">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 text-slate-700 font-medium">{item.name}</td>
                  <td className="py-3 text-slate-800 font-bold text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            No payee data available.
          </div>
        )}
      </div>
    </div>
  )
}
