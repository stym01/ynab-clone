"use server"

import prisma from "@/lib/prisma"
import { requireUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { enableGmailWatch } from "./bankSync"

export async function createAccount(name: string, type: string, startingBalanceCents: number) {
  const user = await requireUser()
  const budget = await prisma.budget.findFirst({ where: { userId: user.id } })
  if (!budget) throw new Error("No budget found")

  const isICICI = type === "icici_credit"
  const actualType = isICICI ? "creditCard" : type

  // Create account
  const account = await prisma.financialAccount.create({
    data: {
      budgetId: budget.id,
      name,
      type: actualType,
      balance: startingBalanceCents,
      syncProvider: isICICI ? "ICICI_GMAIL" : null
    }
  })

  if (isICICI) {
    try {
      // Use the user's specific Pub/Sub topic for the push notification
      await enableGmailWatch(account.id, "projects/gen-lang-client-0222112657/topics/gmail-push")
    } catch (e) {
      console.error("Failed to automatically enable Gmail watch:", e)
    }
  }

  // If Credit Card, create the "Credit Card Payments" group and a category for this card
  if (actualType === "creditCard") {
    let ccGroup = await prisma.categoryGroup.findFirst({
      where: { budgetId: budget.id, name: "Credit Card Payments" }
    })
    
    if (!ccGroup) {
      ccGroup = await prisma.categoryGroup.create({
        data: { budgetId: budget.id, name: "Credit Card Payments", sortOrder: -1 }
      })
    }

    await prisma.category.create({
      data: {
        groupId: ccGroup.id,
        name: name,
        sortOrder: 0
      }
    })
  }

  // Handle "Starting Balance" Payee
  let startingPayee = await prisma.payee.findFirst({
    where: { budgetId: budget.id, name: "Starting Balance" }
  })
  
  if (!startingPayee) {
    startingPayee = await prisma.payee.create({
      data: { name: "Starting Balance", budgetId: budget.id }
    })
  }

  // Create an initial starting balance transaction
  // "Ready to Assign" category is null (Inflow: Ready to Assign)
  await prisma.transaction.create({
    data: {
      accountId: account.id,
      date: new Date(),
      amount: startingBalanceCents, // Positive amount goes to Ready to Assign
      payeeId: startingPayee.id,
      cleared: true,
      memo: "Starting Balance"
    }
  })

  revalidatePath("/")
  return account
}

export async function createTransaction(data: {
  accountId: string,
  categoryId: string | null, // null if Inflow: Ready to Assign
  date: Date,
  amountCents: number, // Negative for outflow (spending), Positive for inflow
  payeeName: string,
  memo: string,
  subTransactions?: { categoryId: string | null, amountCents: number, memo: string }[]
}) {
  const user = await requireUser()
  const budget = await prisma.budget.findFirst({ where: { userId: user.id } })
  if (!budget) throw new Error("No budget")

  let isTransfer = false
  let destAccount = null
  let sourceAccount = null

  if (data.payeeName.startsWith("Transfer: ")) {
    const destAccountName = data.payeeName.replace("Transfer: ", "")
    destAccount = await prisma.financialAccount.findFirst({
      where: { budgetId: budget.id, name: destAccountName }
    })
    if (destAccount) {
      isTransfer = true
      sourceAccount = await prisma.financialAccount.findFirst({
        where: { id: data.accountId }
      })
    }
  }

  // Handle Payees
  let payee = await prisma.payee.findFirst({
    where: { budgetId: budget.id, name: data.payeeName }
  })
  if (!payee && data.payeeName) {
    payee = await prisma.payee.create({
      data: { name: data.payeeName, budgetId: budget.id }
    })
  }

  if (isTransfer && destAccount && sourceAccount) {
    // Need a payee for the destination account too
    const destPayeeName = `Transfer: ${sourceAccount.name}`
    let destPayee = await prisma.payee.findFirst({
      where: { budgetId: budget.id, name: destPayeeName }
    })
    if (!destPayee) {
      destPayee = await prisma.payee.create({
        data: { name: destPayeeName, budgetId: budget.id }
      })
    }

    await prisma.$transaction(async (tx) => {
      // 1. Create source transaction
      const sourceTx = await tx.transaction.create({
        data: {
          accountId: data.accountId,
          categoryId: null, // Transfers don't need categories
          date: data.date,
          amount: data.amountCents,
          payeeId: payee?.id,
          memo: data.memo,
          cleared: false
        }
      })

      // 2. Create destination transaction
      const destTx = await tx.transaction.create({
        data: {
          accountId: destAccount.id,
          categoryId: null,
          date: data.date,
          amount: -data.amountCents, // Reverse the flow
          payeeId: destPayee?.id,
          memo: data.memo,
          cleared: false,
          transferId: sourceTx.id
        }
      })

      // 3. Update balances
      await tx.financialAccount.update({
        where: { id: data.accountId },
        data: { balance: { increment: data.amountCents } }
      })
      await tx.financialAccount.update({
        where: { id: destAccount.id },
        data: { balance: { increment: -data.amountCents } }
      })
    })
  } else {
    // Standard transaction (with or without splits)
    await prisma.$transaction(async (tx) => {
      // Credit Card Automation
      let isCC = false
      let ccCategory = null
      const account = await tx.financialAccount.findUnique({ where: { id: data.accountId } })
      
      if (account?.type === 'creditCard' && data.amountCents < 0) {
        isCC = true
        // Find CC Payment category
        ccCategory = await tx.category.findFirst({
          where: { name: account.name, group: { name: "Credit Card Payments", budgetId: budget.id } }
        })
      }

      const newTx = await tx.transaction.create({
        data: {
          accountId: data.accountId,
          categoryId: data.categoryId,
          date: data.date,
          amount: data.amountCents,
          payeeId: payee?.id,
          memo: data.memo,
          cleared: false,
          ...(data.subTransactions && data.subTransactions.length > 0 ? {
            subTransactions: {
              create: data.subTransactions.map(st => ({
                categoryId: st.categoryId,
                amount: st.amountCents,
                memo: st.memo
              }))
            }
          } : {})
        }
      })

      // If CC Outflow with category, auto-fund CC Payment category
      if (isCC && ccCategory && data.categoryId) {
        const monthStr = data.date.toISOString().substring(0, 7)
        // Upsert MonthlyBudget for CC Payment category
        await tx.monthlyBudget.upsert({
          where: {
            categoryId_month: { categoryId: ccCategory.id, month: monthStr }
          },
          update: {
            assigned: { increment: Math.abs(data.amountCents) }
          },
          create: {
            categoryId: ccCategory.id,
            month: monthStr,
            assigned: Math.abs(data.amountCents)
          }
        })
      }

      await tx.financialAccount.update({
        where: { id: data.accountId },
        data: {
          balance: {
            increment: data.amountCents
          }
        }
      })
    })
  }

  revalidatePath("/")
}

export async function getAccounts() {
  const user = await requireUser()
  const cookieStore = await cookies()
  const activeBudgetId = cookieStore.get("activeBudgetId")?.value

  const budget = await prisma.budget.findFirst({ 
    where: { 
      userId: user.id,
      ...(activeBudgetId ? { id: activeBudgetId } : {})
    } 
  })
  if (!budget) return []

  return prisma.financialAccount.findMany({
    where: { budgetId: budget.id },
    include: {
      transactions: {
        orderBy: { date: 'desc' },
        take: 1 // Only fetch latest for sidebar display
      }
    }
  })
}

export async function toggleTransactionCleared(transactionId: string, cleared: boolean) {
  const user = await requireUser()
  
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { cleared }
  })

  revalidatePath("/")
}

// ===== Phase 4: Transaction Editing & Deletion =====

export async function deleteTransaction(transactionId: string) {
  const user = await requireUser()
  
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { budget: { userId: user.id } } },
    include: { transfer: true, account: true }
  })
  if (!transaction) throw new Error("Transaction not found")

  await prisma.$transaction(async (tx) => {
    // Reverse the account balance
    await tx.financialAccount.update({
      where: { id: transaction.accountId },
      data: { balance: { decrement: transaction.amount } }
    })

    // If this is part of a transfer, delete and reverse the linked transaction too
    if (transaction.transferId) {
      const linkedTx = await tx.transaction.findUnique({ where: { id: transaction.transferId } })
      if (linkedTx) {
        await tx.financialAccount.update({
          where: { id: linkedTx.accountId },
          data: { balance: { decrement: linkedTx.amount } }
        })
        await tx.transaction.delete({ where: { id: linkedTx.id } })
      }
    }
    // Also check if any other transaction links TO this one
    const incomingLink = await tx.transaction.findFirst({ where: { transferId: transactionId } })
    if (incomingLink) {
      await tx.financialAccount.update({
        where: { id: incomingLink.accountId },
        data: { balance: { decrement: incomingLink.amount } }
      })
      await tx.transaction.delete({ where: { id: incomingLink.id } })
    }

    // Delete sub-transactions first
    await tx.subTransaction.deleteMany({ where: { transactionId } })
    
    // Credit Card Automation Reversal
    if (transaction.amount < 0 && transaction.categoryId) {
      const account = await tx.financialAccount.findUnique({ where: { id: transaction.accountId } })
      if (account?.type === 'creditCard') {
        const ccCategory = await tx.category.findFirst({
          where: { name: account.name, group: { name: "Credit Card Payments", budgetId: transaction.account.budgetId } }
        })
        if (ccCategory) {
          const monthStr = transaction.date.toISOString().substring(0, 7)
          await tx.monthlyBudget.updateMany({
            where: { categoryId: ccCategory.id, month: monthStr },
            data: { assigned: { decrement: Math.abs(transaction.amount) } }
          })
        }
      }
    }

    // Delete the transaction itself
    await tx.transaction.delete({ where: { id: transactionId } })
  })

  revalidatePath("/")
}

export async function updateTransaction(transactionId: string, data: {
  date?: string
  payeeName?: string
  categoryId?: string | null
  memo?: string
  amount?: number
  flagColor?: string | null
}) {
  const user = await requireUser()
  
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { budget: { userId: user.id } } }
  })
  if (!transaction) throw new Error("Transaction not found")

  const updateData: any = {}
  
  if (data.date !== undefined) updateData.date = new Date(data.date)
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
  if (data.memo !== undefined) updateData.memo = data.memo
  if (data.flagColor !== undefined) updateData.flagColor = data.flagColor

  // Handle payee change
  if (data.payeeName !== undefined) {
    const budget = await prisma.budget.findFirst({ where: { userId: user.id } })
    if (budget) {
      let payee = await prisma.payee.findFirst({
        where: { budgetId: budget.id, name: data.payeeName }
      })
      if (!payee && data.payeeName) {
        payee = await prisma.payee.create({
          data: { name: data.payeeName, budgetId: budget.id }
        })
      }
      updateData.payeeId = payee?.id || null
    }
  }

  // Handle amount change — adjust account balance
  if (data.amount !== undefined && data.amount !== transaction.amount) {
    const diff = data.amount - transaction.amount
    await prisma.financialAccount.update({
      where: { id: transaction.accountId },
      data: { balance: { increment: diff } }
    })
    updateData.amount = data.amount
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: updateData
  })

  revalidatePath("/")
}

export async function flagTransaction(transactionId: string, color: string | null) {
  const user = await requireUser()
  
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { flagColor: color }
  })

  revalidatePath("/")
}

export async function bulkDeleteTransactions(transactionIds: string[]) {
  const user = await requireUser()
  
  for (const id of transactionIds) {
    await deleteTransaction(id)
  }
}

export async function bulkCategorizeTransactions(transactionIds: string[], categoryId: string) {
  const user = await requireUser()
  
  await prisma.transaction.updateMany({
    where: { 
      id: { in: transactionIds },
      account: { budget: { userId: user.id } }
    },
    data: { categoryId }
  })

  revalidatePath("/")
}

export async function updateAccount(accountId: string, name: string, syncProvider: string | null) {
  const user = await requireUser()
  const account = await prisma.financialAccount.findUnique({ where: { id: accountId }, include: { budget: true } })
  if (!account || account.budget.userId !== user.id) throw new Error("Unauthorized")

  await prisma.financialAccount.update({
    where: { id: accountId },
    data: { name, syncProvider }
  })

  if (syncProvider === "ICICI_GMAIL") {
    try {
      await enableGmailWatch(accountId, "projects/gen-lang-client-0222112657/topics/gmail-push")
    } catch (e) {
      console.error("Failed to enable Gmail watch:", e)
    }
  }

  revalidatePath("/")
}

export async function closeAccount(accountId: string) {
  const user = await requireUser()
  const account = await prisma.financialAccount.findUnique({ where: { id: accountId }, include: { budget: true } })
  if (!account || account.budget.userId !== user.id) throw new Error("Unauthorized")

  await prisma.financialAccount.update({
    where: { id: accountId },
    data: { isClosed: true, syncProvider: null } // Stop sync if closed
  })

  revalidatePath("/")
}

export async function deleteAccount(accountId: string) {
  const user = await requireUser()
  const account = await prisma.financialAccount.findUnique({ where: { id: accountId }, include: { budget: true } })
  if (!account || account.budget.userId !== user.id) throw new Error("Unauthorized")

  await prisma.financialAccount.delete({
    where: { id: accountId }
  })

  revalidatePath("/")
}
