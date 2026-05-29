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

  const processedGroups = budget.categoryGroups.map(group => {
    const categories = group.categories.map(category => {
      
      // Calculate Activity for the specific requested month
      const currentMonthActivity = allTransactions
        .filter(t => t.categoryId === category.id && t.date.toISOString().startsWith(month))
        .reduce((sum, t) => sum + t.amount, 0)
      
      const currentMonthAssigned = category.monthlyBudgets.find(m => m.month === month)?.assigned || 0
      
      // Calculate Rollover from previous months
      let rollover = 0
      
      // Sort months chronologically
      const allMonths = [...new Set([
        ...category.monthlyBudgets.map(m => m.month),
        ...allTransactions.filter(t => t.categoryId === category.id).map(t => t.date.toISOString().substring(0, 7))
      ])].sort()

      for (const m of allMonths) {
        if (m >= month) break // Only calculate up to the month BEFORE the requested month
        
        const mAssigned = category.monthlyBudgets.find(mb => mb.month === m)?.assigned || 0
        const mActivity = allTransactions
          .filter(t => t.categoryId === category.id && t.date.toISOString().startsWith(m))
          .reduce((sum, t) => sum + t.amount, 0)
        
        const mAvailable = rollover + mAssigned + mActivity
        
        if (mAvailable < 0) {
          // Cash overspending is absorbed by RTA in the next month, so rollover resets to 0
          totalOverspendingAbsorbedRTA += Math.abs(mAvailable)
          rollover = 0
        } else {
          // Positive balance rolls over
          rollover = mAvailable
        }
      }

      const available = rollover + currentMonthAssigned + currentMonthActivity
      
      // Add to global assigned total
      totalAssignedAllTime += category.monthlyBudgets.reduce((sum, m) => sum + m.assigned, 0)

      // Get previous month string
      const [y, m] = month.split('-')
      const prevDate = new Date(parseInt(y), parseInt(m) - 2, 1)
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

      const assignedLastMonth = category.monthlyBudgets.find(m => m.month === prevMonthStr)?.assigned || 0
      const spentLastMonth = Math.abs(allTransactions
        .filter(t => t.categoryId === category.id && t.date.toISOString().startsWith(prevMonthStr) && t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0))

      // NEW LOGIC: Calculate Monthly Target Amount for Advanced Targets
      let monthlyTargetAmount = category.target
      
      if (category.target > 0) {
        if (category.targetCadence === 'YEARLY' || category.targetCadence === 'BY_DATE') {
          if (category.targetDate) {
            const targetDate = new Date(category.targetDate)
            const currentMonthDate = new Date(parseInt(y), parseInt(m) - 1, 1)
            
            // Calculate months difference
            let monthsLeft = (targetDate.getFullYear() - currentMonthDate.getFullYear()) * 12 
                           + (targetDate.getMonth() - currentMonthDate.getMonth())
                           
            // If the target is in the past or this month, monthsLeft should be at least 1
            if (monthsLeft < 1) monthsLeft = 1
            
            // Remaining needed is Total Target - What we had available at the START of the month
            const remainingToFund = Math.max(0, category.target - rollover)
            
            // The monthly goal is the remaining amount divided by months left
            // E.g. $645 target, $0 rollover, 11 months left -> 645/11 = 58.636 => 5864 cents
            monthlyTargetAmount = Math.ceil(remainingToFund / monthsLeft)
          }
        }
      }

      return {
        id: category.id,
        name: category.name,
        assigned: currentMonthAssigned,
        activity: currentMonthActivity,
        available: available,
        assignedLastMonth,
        spentLastMonth,
        targetType: category.targetType,
        target: category.target,
        targetCadence: category.targetCadence,
        targetDate: category.targetDate,
        monthlyTargetAmount: monthlyTargetAmount,
      }
    })

    return {
      id: group.id,
      budgetId: group.budgetId,
      name: group.name,
      isExpanded: true,
      categories
    }
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

export async function updateCategoryTarget(categoryId: string, targetType: string, target: number, targetCadence?: string | null, targetDate?: Date | null) {
  const user = await requireUser()

  await prisma.category.update({
    where: { id: categoryId },
    data: {
      targetType,
      target,
      targetCadence: targetCadence || null,
      targetDate: targetDate || null,
    }
  })

  revalidatePath("/budget")
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
