import Header from "@/components/Layout/Header"
import BudgetView from "@/components/Budget/BudgetView"
import { getBudgetData } from "@/app/actions/budget"
import React from "react"
import { requireUser } from "@/lib/session"
import prisma from "@/lib/prisma"

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser()
  const sp = await searchParams
  
  // Create a default budget if none exists
  let budget = await prisma.budget.findFirst({ 
    where: { userId: user.id },
    include: { categoryGroups: true }
  })

  if (!budget) {
    budget = await prisma.budget.create({
      data: {
        userId: user.id,
        name: "My Budget",
      },
      include: { categoryGroups: true }
    })
  }

  // If budget exists but has no groups (e.g. from seed script), create them
  if (budget.categoryGroups.length === 0) {
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
  }

  const today = new Date()
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const currentMonth = sp?.month || defaultMonth
  
  const initialData = await getBudgetData(currentMonth)

  return (
    <BudgetView 
      initialData={initialData?.budget} 
      month={currentMonth} 
      readyToAssign={initialData?.readyToAssign || 0} 
      totalInflows={initialData?.totalInflows || 0}
      totalAssigned={initialData?.totalAssigned || 0}
      totalOverspending={initialData?.totalOverspending || 0}
      monthNote={initialData?.monthNote || ""}
    />
  )
}
