import React from "react"
import prisma from "@/lib/prisma"
import { requireUser } from "@/lib/session"
import LedgerClient from "@/components/Ledger/LedgerClient"

export default async function AccountLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser()
  
  const account = await prisma.financialAccount.findFirst({
    where: { id: id, budget: { userId: user.id } },
    include: {
      transactions: {
        orderBy: { date: 'desc' },
        include: {
          category: true,
          payee: true,
          subTransactions: {
            include: { category: true }
          }
        }
      }
    }
  })

  if (!account) return <div>Account not found</div>

  // Fetch categories for the transaction dropdown
  const categories = await prisma.category.findMany({
    where: { group: { budgetId: account.budgetId }, isHidden: false },
    include: { group: true },
    orderBy: [
      { group: { sortOrder: 'asc' } },
      { sortOrder: 'asc' }
    ]
  })

  // Fetch payees for the transaction dropdown
  const payees = await prisma.payee.findMany({
    where: { budgetId: account.budgetId },
    orderBy: { name: 'asc' }
  })

  return <LedgerClient account={account} categories={categories} payees={payees} />
}
