import React from "react"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import BankSyncClient from "./BankSyncClient"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      budgets: {
        include: { accounts: true }
      },
      accounts: true // OAuth accounts
    }
  })

  if (!user || !user.budgets || user.budgets.length === 0) {
    return <div>No budgets found.</div>
  }

  const activeBudget = user.budgets[0] // Simplify by taking first budget
  const hasGoogleOauth = user.accounts.some(a => a.provider === 'google')

  return (
    <div className="flex-1 bg-white p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Settings</h1>
      
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-blue-100 text-[#005A87] flex items-center justify-center">🏛️</span>
          Bank Sync (Experimental)
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Connect your YNAB clone to your real bank. Currently supports ICICI Bank Credit Cards via Gmail Push Notifications.
        </p>

        <BankSyncClient 
          accounts={activeBudget.accounts} 
          hasGoogleOauth={hasGoogleOauth} 
        />
      </div>
    </div>
  )
}
