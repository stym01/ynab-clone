import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireUser } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const budgetId = searchParams.get('budgetId')

    if (!budgetId) {
      return NextResponse.json({ error: 'Budget ID is required' }, { status: 400 })
    }

    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId: user.id
      },
      include: {
        accounts: {
          include: {
            transactions: {
              include: {
                subTransactions: true
              }
            }
          }
        },
        categoryGroups: {
          include: {
            categories: {
              include: {
                monthlyBudgets: true
              }
            }
          }
        },
        payees: true
      }
    })

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    // Return the full JSON payload
    return NextResponse.json(budget)

  } catch (error) {
    console.error('Export Error:', error)
    return NextResponse.json({ error: 'Failed to export budget data' }, { status: 500 })
  }
}
