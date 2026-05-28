import React from "react"
import prisma from "@/lib/prisma"
import { requireUser } from "@/lib/session"
import NetWorthChart from "@/components/Reports/NetWorthChart"
import IncomeExpenseChart from "@/components/Reports/IncomeExpenseChart"
import SpendingByCategoryChart from "@/components/Reports/SpendingByCategoryChart"
import SpendingByPayeeTable from "@/components/Reports/SpendingByPayeeTable"
import { formatCurrency } from "@/lib/currency"

export default async function ReportsPage() {
  const user = await requireUser()
  const cookieStore = await (await import("next/headers")).cookies()
  const activeBudgetId = cookieStore.get("activeBudgetId")?.value

  const budget = await prisma.budget.findFirst({
    where: { 
      userId: user.id,
      ...(activeBudgetId ? { id: activeBudgetId } : {})
    },
    include: {
      accounts: {
        include: {
          transactions: {
            orderBy: { date: 'asc' },
            include: { category: true, payee: true }
          }
        }
      }
    }
  })

  if (!budget) {
    return <div className="p-8">No budget found.</div>
  }

  // --- Aggregate Net Worth Data ---
  const allTransactions = budget.accounts.flatMap(acc => acc.transactions).sort((a, b) => a.date.getTime() - b.date.getTime())
  
  let runningNetWorth = 0
  const netWorthByMonth: Record<string, number> = {}
  
  // Aggregate Income/Expense by Month
  const incomeExpenseByMonth: Record<string, { income: number, expense: number }> = {}

  // Aggregate spending by category and payee
  const spendingByCategory: Record<string, { name: string, total: number }> = {}
  const spendingByPayee: Record<string, { name: string, total: number }> = {}

  for (const t of allTransactions) {
    const d = new Date(t.date)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    
    // Net Worth tracking
    runningNetWorth += t.amount
    netWorthByMonth[monthKey] = runningNetWorth

    // Income vs Expense tracking
    if (!incomeExpenseByMonth[monthKey]) {
      incomeExpenseByMonth[monthKey] = { income: 0, expense: 0 }
    }
    
    if (t.amount > 0) {
      incomeExpenseByMonth[monthKey].income += t.amount
    } else if (t.amount < 0) {
      incomeExpenseByMonth[monthKey].expense += Math.abs(t.amount)
    }

    // Spending by category
    if (t.amount < 0 && t.category) {
      if (!spendingByCategory[t.category.id]) {
        spendingByCategory[t.category.id] = { name: t.category.name, total: 0 }
      }
      spendingByCategory[t.category.id].total += Math.abs(t.amount)
    }

    // Spending by payee
    if (t.amount < 0 && t.payee) {
      if (!spendingByPayee[t.payee.id]) {
        spendingByPayee[t.payee.id] = { name: t.payee.name, total: 0 }
      }
      spendingByPayee[t.payee.id].total += Math.abs(t.amount)
    }
  }

  const categoryData = Object.values(spendingByCategory)
  const payeeData = Object.values(spendingByPayee)

  // Top spending categories (sorted by total, top 5) for quick stats
  const topSpending = [...categoryData].sort((a, b) => b.total - a.total).slice(0, 5)

  // Format data for Recharts
  const netWorthData = Object.entries(netWorthByMonth).map(([month, paise]) => {
    const [y, m] = month.split('-')
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    return { date: dateStr, netWorth: paise / 100 }
  })
  
  const incomeExpenseData = Object.entries(incomeExpenseByMonth).map(([month, data]) => {
    const [y, m] = month.split('-')
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    return { date: dateStr, income: data.income / 100, expense: data.expense / 100 }
  })

  // --- Calculate Age of Money (FIFO over last 10 outflows) ---
  const inflows = allTransactions.filter(t => t.amount > 0).map(t => ({ amount: t.amount, date: new Date(t.date).getTime() }))
  const outflows = allTransactions.filter(t => t.amount < 0).map(t => ({ amount: Math.abs(t.amount), date: new Date(t.date).getTime() }))
  
  const outflowAges: number[] = []
  let inflowIndex = 0
  let currentInflowBucket = inflows.length > 0 ? inflows[0].amount : 0

  for (const out of outflows) {
    let remainingOutflow = out.amount
    let weightedAgeSum = 0
    let totalAssignedToThisOutflow = 0

    while (remainingOutflow > 0 && inflowIndex < inflows.length) {
      const availableInBucket = currentInflowBucket
      if (availableInBucket === 0) {
        inflowIndex++
        if (inflowIndex < inflows.length) currentInflowBucket = inflows[inflowIndex].amount
        continue
      }

      const amountToTake = Math.min(remainingOutflow, availableInBucket)
      currentInflowBucket -= amountToTake
      remainingOutflow -= amountToTake

      const ageInMs = out.date - inflows[inflowIndex].date
      const ageInDays = Math.max(0, Math.floor(ageInMs / (1000 * 60 * 60 * 24)))
      
      weightedAgeSum += ageInDays * amountToTake
      totalAssignedToThisOutflow += amountToTake
    }

    if (totalAssignedToThisOutflow > 0) {
      outflowAges.push(weightedAgeSum / totalAssignedToThisOutflow)
    }
  }

  const last10Ages = outflowAges.slice(-10)
  const ageOfMoney = last10Ages.length > 0 ? Math.round(last10Ages.reduce((a, b) => a + b, 0) / last10Ages.length) : 0

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-500 mt-2">Visualize your financial progress and spending habits.</p>
        </div>

        <NetWorthChart data={netWorthData} />
        
        <IncomeExpenseChart data={incomeExpenseData} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SpendingByCategoryChart data={categoryData} />
          <SpendingByPayeeTable data={payeeData} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-48">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">Age of Money</div>
            <div className="text-5xl font-bold text-[#23B573]">
              {ageOfMoney} <span className="text-xl text-slate-400 font-medium">days</span>
            </div>
            <p className="text-sm text-slate-400 mt-2 text-center">
              {ageOfMoney > 30 ? "Your money is aging perfectly!" : "Try to get this above 30 days!"}
            </p>
          </div>
          
          {/* Top Spending Category — Real Data */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center h-48">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Top Spending Categories</div>
            {topSpending.length > 0 ? (
              topSpending.slice(0, 3).map((cat, i) => (
                <div key={i} className={`flex justify-between items-center ${i < 2 ? 'border-b border-slate-100 pb-2 mb-2' : ''}`}>
                  <span className="font-semibold text-slate-700">{cat.name}</span>
                  <span className="font-bold text-slate-800">{formatCurrency(cat.total)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No spending data yet. Add transactions to see your top categories.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

