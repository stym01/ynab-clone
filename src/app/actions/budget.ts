"use server"

import prisma from "@/lib/prisma"
import { requireUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

export async function getBudgetData(month: string) {
  const user = await requireUser()
  const cookieStore = await cookies()
  const activeBudgetId = cookieStore.get("activeBudgetId")?.value

  const budget = await prisma.budget.findFirst({
    where: { 
      userId: user.id,
      ...(activeBudgetId ? { id: activeBudgetId } : {})
    },
    include: {
      categoryGroups: {
        where: { isHidden: false },
        orderBy: { sortOrder: 'asc' },
        include: {
          categories: {
            where: { isHidden: false },
            orderBy: { sortOrder: 'asc' },
            include: {
              monthlyBudgets: true, // Fetch all to calculate rollover
            }
          }
        }
      },
      accounts: {
        include: {
          transactions: true // Fetch all to calculate activity and rollover
        }
      }
    }
  })

  if (!budget) return null

  // Process data chronologically to calculate rollover
  const allTransactions = budget.accounts.flatMap(a => a.transactions)
  
  let totalInflowsToRTA = 0
  let totalAssignedAllTime = 0
  let totalOverspendingAbsorbedRTA = 0

  const ccAccounts = budget.accounts.filter(a => a.type === 'creditCard')
  
  const allMonthsSet = new Set<string>()
  budget.categoryGroups.forEach(g => g.categories.forEach(c => {
    c.monthlyBudgets.forEach(m => allMonthsSet.add(m.month))
  }))
  allTransactions.forEach(t => allMonthsSet.add(t.date.toISOString().substring(0, 7)))
  allMonthsSet.add(month)
  const allMonths = Array.from(allMonthsSet).sort().filter(m => m <= month)
  
  const fundedCCSpending: Record<string, Record<string, number>> = {}
  
  const startOfMonthRollover: Record<string, number> = {}
  const currentMonthAvailable: Record<string, number> = {}
  const currentMonthActivity: Record<string, number> = {}

  budget.categoryGroups.forEach(g => g.categories.forEach(category => {
    startOfMonthRollover[category.id] = 0
  }))

  for (const m of allMonths) {
    fundedCCSpending[m] = {}
    ccAccounts.forEach(cc => fundedCCSpending[m][cc.id] = 0)

    budget.categoryGroups.forEach(g => g.categories.forEach(category => {
      if (category.linkedAccountId) return
      
      const mAssigned = category.monthlyBudgets.find(mb => mb.month === m)?.assigned || 0
      const mTransactions = allTransactions.filter(t => t.categoryId === category.id && t.date.toISOString().startsWith(m))
      
      const inflows = mTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
      const outflows = Math.abs(mTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
      const cashOutflows = Math.abs(mTransactions.filter(t => t.amount < 0 && !ccAccounts.some(cc => cc.id === t.accountId)).reduce((sum, t) => sum + t.amount, 0))
      
      const ccOutflowsByAccount: Record<string, number> = {}
      ccAccounts.forEach(cc => ccOutflowsByAccount[cc.id] = 0)
      mTransactions.filter(t => t.amount < 0 && ccAccounts.some(cc => cc.id === t.accountId)).forEach(t => {
        ccOutflowsByAccount[t.accountId] += Math.abs(t.amount)
      })
      
      const totalCCOutflows = Object.values(ccOutflowsByAccount).reduce((sum, val) => sum + val, 0)
      
      const startingAvailable = startOfMonthRollover[category.id] + mAssigned + inflows
      const availableForCC = Math.max(0, startingAvailable - cashOutflows)
      const totalFundedCC = Math.min(totalCCOutflows, availableForCC)
      
      if (totalCCOutflows > 0 && totalFundedCC > 0) {
        Object.entries(ccOutflowsByAccount).forEach(([ccId, amount]) => {
          const share = amount / totalCCOutflows
          fundedCCSpending[m][ccId] += totalFundedCC * share
        })
      }
      
      const mAvailable = startingAvailable - cashOutflows - totalCCOutflows
      
      if (m === month) {
        currentMonthActivity[category.id] = inflows - outflows
        currentMonthAvailable[category.id] = mAvailable
      }
      
      if (mAvailable < 0) {
        const cashOverspending = Math.max(0, cashOutflows - startingAvailable)
        if (m < month) {
          totalOverspendingAbsorbedRTA += cashOverspending
        }
        if (m !== month) startOfMonthRollover[category.id] = 0
      } else {
        if (m !== month) startOfMonthRollover[category.id] = mAvailable
      }
    }))
  }
  
  for (const m of allMonths) {
    budget.categoryGroups.forEach(g => g.categories.forEach(category => {
      if (!category.linkedAccountId) return
      
      const ccId = category.linkedAccountId
      const mAssigned = category.monthlyBudgets.find(mb => mb.month === m)?.assigned || 0
      const mFunded = fundedCCSpending[m]?.[ccId] || 0
      const mPayments = allTransactions
        .filter(t => t.accountId === ccId && !t.categoryId && t.amount > 0 && t.date.toISOString().startsWith(m))
        .reduce((sum, t) => sum + t.amount, 0)
        
      const mActivity = mFunded - mPayments
      const mAvailable = startOfMonthRollover[category.id] + mAssigned + mActivity
      
      if (m === month) {
        currentMonthActivity[category.id] = mActivity
        currentMonthAvailable[category.id] = mAvailable
      }
      
      if (m !== month) {
        startOfMonthRollover[category.id] = mAvailable
      }
    }))
  }

  const processedGroups = budget.categoryGroups.map(group => {
    const categories = group.categories.map(category => {
      
      const currentMonthAssigned = category.monthlyBudgets.find(m => m.month === month)?.assigned || 0
      const currentMonthActivityVal = currentMonthActivity[category.id] || 0
      const available = currentMonthAvailable[category.id] || 0
      const rollover = startOfMonthRollover[category.id] || 0
      
      totalAssignedAllTime += category.monthlyBudgets.reduce((sum, m) => sum + m.assigned, 0)

      const [y, mStr] = month.split('-')
      const prevDate = new Date(parseInt(y), parseInt(mStr) - 2, 1)
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

      const assignedLastMonth = category.monthlyBudgets.find(m => m.month === prevMonthStr)?.assigned || 0
      let spentLastMonth = 0
      if (!category.linkedAccountId) {
        spentLastMonth = Math.abs(allTransactions
          .filter(t => t.categoryId === category.id && t.date.toISOString().startsWith(prevMonthStr) && t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0))
      }

      let monthlyTargetAmount = category.target
      
      let effectiveTargetDate = category.targetDate ? new Date(category.targetDate) : null
      
      if (category.target > 0) {
        if (category.targetCadence === 'YEARLY' || category.targetCadence === 'BY_DATE') {
          if (effectiveTargetDate) {
            const currentMonthDate = new Date(parseInt(y), parseInt(mStr) - 1, 1)
            
            if (category.targetRepeatEvery && category.targetRepeatCadence && effectiveTargetDate < currentMonthDate) {
              while (effectiveTargetDate < currentMonthDate) {
                if (category.targetRepeatCadence === 'MONTHS') {
                  effectiveTargetDate.setMonth(effectiveTargetDate.getMonth() + category.targetRepeatEvery)
                } else if (category.targetRepeatCadence === 'YEARS') {
                  effectiveTargetDate.setFullYear(effectiveTargetDate.getFullYear() + category.targetRepeatEvery)
                }
              }
            }
            
            let monthsLeft = (effectiveTargetDate.getFullYear() - currentMonthDate.getFullYear()) * 12 
                           + (effectiveTargetDate.getMonth() - currentMonthDate.getMonth())
                           
            if (monthsLeft < 1) monthsLeft = 1
            
            const remainingToFund = Math.max(0, category.target - rollover)
            monthlyTargetAmount = Math.ceil(remainingToFund / monthsLeft)
          }
        }
      }

      return {
        id: category.id,
        name: category.name,
        assigned: currentMonthAssigned,
        activity: currentMonthActivityVal,
        available: available,
        assignedLastMonth,
        spentLastMonth,
        targetType: category.targetType,
        target: category.target,
        targetCadence: category.targetCadence,
        targetDate: category.targetDate,
        effectiveTargetDate: effectiveTargetDate,
        targetRepeatEvery: category.targetRepeatEvery,
        targetRepeatCadence: category.targetRepeatCadence,
        monthlyTargetAmount: monthlyTargetAmount,
        linkedAccountId: category.linkedAccountId,
      }
    })

    return {
      id: group.id,
      budgetId: group.budgetId,
      name: group.name,
      isExpanded: true,
      categories
    }
  })


  // Calculate Ready to Assign
  allTransactions.forEach(t => {
    if (!t.categoryId && t.amount > 0) {
      totalInflowsToRTA += t.amount
    }
  })

  // Ready To Assign = Total Inflows - Total Assigned - Overspending Absorbed
  const readyToAssign = totalInflowsToRTA - totalAssignedAllTime - totalOverspendingAbsorbedRTA

  return { 
    budget: { ...budget, categoryGroups: processedGroups }, 
    readyToAssign,
    totalInflows: totalInflowsToRTA,
    totalAssigned: totalAssignedAllTime,
    totalOverspending: totalOverspendingAbsorbedRTA
  }
}

export async function updateCategoryAssigned(categoryId: string, month: string, newAssignedAmount: number) {
  const user = await requireUser()

  await prisma.monthlyBudget.upsert({
    where: {
      categoryId_month: { categoryId, month }
    },
    update: {
      assigned: newAssignedAmount
    },
    create: {
      categoryId,
      month,
      assigned: newAssignedAmount
    }
  })

  revalidatePath("/budget")
}

export async function updateCategoryTarget(categoryId: string, targetType: string, target: number, targetCadence?: string | null, targetDate?: Date | null, targetRepeatEvery?: number | null, targetRepeatCadence?: string | null) {
  const user = await requireUser()

  await prisma.category.update({
    where: { id: categoryId },
    data: {
      targetType,
      target,
      targetCadence: targetCadence || null,
      targetDate: targetDate || null,
      targetRepeatEvery: targetRepeatEvery || null,
      targetRepeatCadence: targetRepeatCadence || null,
    }
  })

  revalidatePath("/budget")
}

export async function getCategoryTransactions(categoryId: string, month: string) {
  const user = await requireUser()
  
  // month is "YYYY-MM"
  const [y, m] = month.split('-')
  const startDate = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1))
  const endDate = new Date(Date.UTC(parseInt(y), parseInt(m), 1))

  const transactions = await prisma.transaction.findMany({
    where: {
      categoryId,
      date: {
        gte: startDate,
        lt: endDate
      },
      account: {
        budget: {
          userId: user.id
        }
      }
    },
    include: {
      account: { select: { name: true } },
      payee: { select: { name: true } }
    },
    orderBy: { date: 'desc' }
  })

  // We need to map and format it slightly so it's clean for the UI
  return transactions.map(t => ({
    id: t.id,
    date: t.date.toISOString(),
    accountName: t.account.name,
    payeeName: t.payee?.name || '',
    memo: t.memo || '',
    amount: t.amount
  }))
}

export async function createBudget(name: string) {
  const user = await requireUser()
  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      name
    }
  })

  // Create default groups for new budget
  await prisma.categoryGroup.create({
    data: {
      budgetId: budget.id,
      name: "Immediate Obligations",
      sortOrder: 0,
      categories: {
        create: [
          { name: "Rent/Mortgage", sortOrder: 0 },
          { name: "Groceries", sortOrder: 1 },
        ]
      }
    }
  })
  await prisma.categoryGroup.create({
    data: {
      budgetId: budget.id,
      name: "True Expenses",
      sortOrder: 1,
      categories: {
        create: [
          { name: "Auto Maintenance", sortOrder: 0 },
          { name: "Home Maintenance", sortOrder: 1 },
        ]
      }
    }
  })

  const cookieStore = await cookies()
  cookieStore.set("activeBudgetId", budget.id, { path: "/" })

  revalidatePath("/")
  return budget
}

export async function switchBudget(budgetId: string) {
  const user = await requireUser()
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, userId: user.id } })
  if (budget) {
    const cookieStore = await cookies()
    cookieStore.set("activeBudgetId", budget.id, { path: "/" })
    revalidatePath("/")
  }
}

export async function createCategoryGroup(budgetId: string, name: string) {
  const user = await requireUser()
  // Just verify user has access
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, userId: user.id } })
  if (!budget) throw new Error("Budget not found")

  // Get highest sortOrder to place new group at the end
  const lastGroup = await prisma.categoryGroup.findFirst({
    where: { budgetId: budget.id, isHidden: false },
    orderBy: { sortOrder: 'desc' }
  })

  const group = await prisma.categoryGroup.create({
    data: {
      budgetId: budget.id,
      name,
      sortOrder: (lastGroup?.sortOrder ?? -1) + 1
    }
  })
  revalidatePath("/")
  return group
}

// ===== Phase 3: Category & Group CRUD =====

export async function addCategory(groupId: string, name: string) {
  const user = await requireUser()
  
  // Verify access
  const group = await prisma.categoryGroup.findFirst({
    where: { id: groupId, budget: { userId: user.id } }
  })
  if (!group) throw new Error("Group not found")

  // Get highest sortOrder within this group
  const lastCategory = await prisma.category.findFirst({
    where: { groupId: groupId, isHidden: false },
    orderBy: { sortOrder: 'desc' }
  })

  const category = await prisma.category.create({
    data: {
      groupId,
      name,
      sortOrder: (lastCategory?.sortOrder ?? -1) + 1
    }
  })

  revalidatePath("/budget")
  return category
}

export async function renameCategory(categoryId: string, newName: string) {
  const user = await requireUser()
  
  // Verify access
  const category = await prisma.category.findFirst({
    where: { id: categoryId, group: { budget: { userId: user.id } } }
  })
  if (!category) throw new Error("Category not found")

  await prisma.category.update({
    where: { id: categoryId },
    data: { name: newName }
  })

  revalidatePath("/budget")
}

export async function deleteCategory(categoryId: string) {
  const user = await requireUser()
  
  // Verify access
  const category = await prisma.category.findFirst({
    where: { id: categoryId, group: { budget: { userId: user.id } } }
  })
  if (!category) throw new Error("Category not found")

  // Soft delete — hide the category
  await prisma.category.update({
    where: { id: categoryId },
    data: { isHidden: true }
  })

  revalidatePath("/budget")
}

export async function renameCategoryGroup(groupId: string, newName: string) {
  const user = await requireUser()
  
  const group = await prisma.categoryGroup.findFirst({
    where: { id: groupId, budget: { userId: user.id } }
  })
  if (!group) throw new Error("Group not found")

  await prisma.categoryGroup.update({
    where: { id: groupId },
    data: { name: newName }
  })

  revalidatePath("/budget")
}

export async function deleteCategoryGroup(groupId: string) {
  const user = await requireUser()
  
  const group = await prisma.categoryGroup.findFirst({
    where: { id: groupId, budget: { userId: user.id } }
  })
  if (!group) throw new Error("Group not found")

  // Soft delete the group and all its categories
  await prisma.categoryGroup.update({
    where: { id: groupId },
    data: { isHidden: true }
  })
  await prisma.category.updateMany({
    where: { groupId },
    data: { isHidden: true }
  })

  revalidatePath("/budget")
}

export async function moveCategoryToGroup(categoryId: string, targetGroupId: string) {
  const user = await requireUser()
  
  // Verify both belong to the user
  const category = await prisma.category.findFirst({
    where: { id: categoryId, group: { budget: { userId: user.id } } }
  })
  if (!category) throw new Error("Category not found")

  const targetGroup = await prisma.categoryGroup.findFirst({
    where: { id: targetGroupId, budget: { userId: user.id } }
  })
  if (!targetGroup) throw new Error("Target group not found")

  // Get last sortOrder in target group
  const lastInTarget = await prisma.category.findFirst({
    where: { groupId: targetGroupId, isHidden: false },
    orderBy: { sortOrder: 'desc' }
  })

  await prisma.category.update({
    where: { id: categoryId },
    data: { 
      groupId: targetGroupId,
      sortOrder: (lastInTarget?.sortOrder ?? -1) + 1
    }
  })

  revalidatePath("/budget")
}

export async function reorderCategories(groupId: string, orderedCategoryIds: string[]) {
  const user = await requireUser()
  
  // Verify access
  const group = await prisma.categoryGroup.findFirst({
    where: { id: groupId, budget: { userId: user.id } }
  })
  if (!group) throw new Error("Group not found")

  // Update sortOrder for each category
  await Promise.all(
    orderedCategoryIds.map((catId, index) =>
      prisma.category.update({
        where: { id: catId },
        data: { sortOrder: index }
      })
    )
  )

  revalidatePath("/budget")
}

export async function reorderCategoryGroups(budgetId: string, orderedGroupIds: string[]) {
  const user = await requireUser()
  
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId: user.id }
  })
  if (!budget) throw new Error("Budget not found")

  await Promise.all(
    orderedGroupIds.map((gId, index) =>
      prisma.categoryGroup.update({
        where: { id: gId },
        data: { sortOrder: index }
      })
    )
  )

  revalidatePath("/budget")
}

export async function moveMoney(month: string, fromId: string, toId: string, amount: number) {
  const user = await requireUser()
  
  if (fromId === toId || amount <= 0) return;

  // Verify ownership
  const categoryIdsToCheck = [fromId, toId].filter(id => id !== "RTA");
  if (categoryIdsToCheck.length > 0) {
    const categories = await prisma.category.findMany({
      where: { 
        id: { in: categoryIdsToCheck }, 
        group: { budget: { userId: user.id } } 
      }
    });
    if (categories.length !== categoryIdsToCheck.length) {
      throw new Error("Category not found or unauthorized");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (fromId !== "RTA") {
      await tx.monthlyBudget.upsert({
        where: { categoryId_month: { categoryId: fromId, month } },
        update: { assigned: { decrement: amount } },
        create: { categoryId: fromId, month, assigned: -amount }
      })
    }

    if (toId !== "RTA") {
      await tx.monthlyBudget.upsert({
        where: { categoryId_month: { categoryId: toId, month } },
        update: { assigned: { increment: amount } },
        create: { categoryId: toId, month, assigned: amount }
      })
    }
  })

  revalidatePath("/budget")
}

export async function renameBudget(id: string, newName: string) {
  const user = await requireUser()
  
  if (!newName.trim()) throw new Error("Name cannot be empty")

  await prisma.budget.update({
    where: { id, userId: user.id },
    data: { name: newName.trim() }
  })

  revalidatePath("/")
}

export async function deleteBudget(id: string) {
  const user = await requireUser()
  
  // Verify ownership
  const budget = await prisma.budget.findFirst({
    where: { id, userId: user.id }
  })
  if (!budget) throw new Error("Budget not found")

  await prisma.budget.delete({
    where: { id }
  })

  // Clear active cookie if it matches the deleted budget
  const cookieStore = await cookies()
  if (cookieStore.get("activeBudgetId")?.value === id) {
    cookieStore.delete("activeBudgetId")
  }

  revalidatePath("/")
}
