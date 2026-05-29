import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireUser } from '@/lib/session'

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const budgetData = await request.json()

    if (!budgetData || !budgetData.name) {
      return NextResponse.json({ error: 'Invalid budget data' }, { status: 400 })
    }

    // Maps to track old IDs to new IDs
    const categoryMap = new Map<string, string>()
    const payeeMap = new Map<string, string>()
    const accountMap = new Map<string, string>()
    const transactionMap = new Map<string, string>()

    // Use a transaction for safe multi-step insert
    const newBudget = await prisma.$transaction(async (tx) => {
      // 1. Create Budget
      const budget = await tx.budget.create({
        data: {
          name: `${budgetData.name} (Imported)`,
          userId: user.id,
        }
      })

      // 2. Create CategoryGroups and Categories
      if (budgetData.categoryGroups) {
        for (const oldGroup of budgetData.categoryGroups) {
          const newGroup = await tx.categoryGroup.create({
            data: {
              budgetId: budget.id,
              name: oldGroup.name,
              sortOrder: oldGroup.sortOrder,
              isHidden: oldGroup.isHidden,
            }
          })

          if (oldGroup.categories) {
            for (const oldCat of oldGroup.categories) {
              const newCat = await tx.category.create({
                data: {
                  groupId: newGroup.id,
                  name: oldCat.name,
                  target: oldCat.target,
                  targetType: oldCat.targetType,
                  targetCadence: oldCat.targetCadence,
                  targetDay: oldCat.targetDay,
                  targetMonth: oldCat.targetMonth,
                  targetDate: oldCat.targetDate ? new Date(oldCat.targetDate) : null,
                  sortOrder: oldCat.sortOrder,
                  isHidden: oldCat.isHidden,
                }
              })
              categoryMap.set(oldCat.id, newCat.id)

              // 2b. Create Monthly Budgets for this category
              if (oldCat.monthlyBudgets) {
                await tx.monthlyBudget.createMany({
                  data: oldCat.monthlyBudgets.map((mb: any) => ({
                    categoryId: newCat.id,
                    month: mb.month,
                    assigned: mb.assigned,
                    snoozed: mb.snoozed,
                    note: mb.note,
                  }))
                })
              }
            }
          }
        }
      }

      // 3. Create Payees
      if (budgetData.payees) {
        for (const oldPayee of budgetData.payees) {
          const newPayee = await tx.payee.create({
            data: {
              budgetId: budget.id,
              name: oldPayee.name,
            }
          })
          payeeMap.set(oldPayee.id, newPayee.id)
        }
      }

      // 4. Create Financial Accounts
      if (budgetData.accounts) {
        for (const oldAccount of budgetData.accounts) {
          const newAccount = await tx.financialAccount.create({
            data: {
              budgetId: budget.id,
              name: oldAccount.name,
              type: oldAccount.type,
              balance: oldAccount.balance,
              isClosed: oldAccount.isClosed,
              syncProvider: oldAccount.syncProvider,
              historyId: oldAccount.historyId,
            }
          })
          accountMap.set(oldAccount.id, newAccount.id)
        }
      }

      // 5. Create Transactions
      if (budgetData.accounts) {
        // Collect all transactions from all accounts
        const allOldTransactions: any[] = []
        budgetData.accounts.forEach((acc: any) => {
          if (acc.transactions) {
            allOldTransactions.push(...acc.transactions)
          }
        })

        // Sort by date just to be clean
        allOldTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // Insert transactions one by one to handle IDs and subtransactions
        for (const oldTx of allOldTransactions) {
          const mappedAccountId = accountMap.get(oldTx.accountId)
          if (!mappedAccountId) continue // Skip if account wasn't mapped for some reason

          const newTx = await tx.transaction.create({
            data: {
              accountId: mappedAccountId,
              categoryId: oldTx.categoryId ? categoryMap.get(oldTx.categoryId) || null : null,
              payeeId: oldTx.payeeId ? payeeMap.get(oldTx.payeeId) || null : null,
              date: new Date(oldTx.date),
              amount: oldTx.amount,
              memo: oldTx.memo,
              cleared: oldTx.cleared,
              flagColor: oldTx.flagColor,
            }
          })
          transactionMap.set(oldTx.id, newTx.id)

          // SubTransactions
          if (oldTx.subTransactions && oldTx.subTransactions.length > 0) {
            await tx.subTransaction.createMany({
              data: oldTx.subTransactions.map((st: any) => ({
                transactionId: newTx.id,
                categoryId: st.categoryId ? categoryMap.get(st.categoryId) || null : null,
                amount: st.amount,
                memo: st.memo,
              }))
            })
          }
        }

        // 6. Fix up transfers
        // Transfers have a transferId pointing to another transaction.
        // Now that we have all new transaction IDs, we can link them.
        for (const oldTx of allOldTransactions) {
          if (oldTx.transferId && transactionMap.has(oldTx.id)) {
            const mappedTransferId = transactionMap.get(oldTx.transferId)
            const mappedMyId = transactionMap.get(oldTx.id)
            if (mappedTransferId && mappedMyId) {
              await tx.transaction.update({
                where: { id: mappedMyId },
                data: { transferId: mappedTransferId }
              })
            }
          }
        }
      }

      return budget
    }, {
      maxWait: 15000, 
      timeout: 30000 // Import can take a bit of time for large budgets
    })

    return NextResponse.json(newBudget)

  } catch (error) {
    console.error('Import Error:', error)
    return NextResponse.json({ error: 'Failed to import budget data' }, { status: 500 })
  }
}
