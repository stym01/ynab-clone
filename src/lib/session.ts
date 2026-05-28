import { getServerSession } from "next-auth/next"
import { authOptions } from "./authOptions"
import { redirect } from "next/navigation"
import prisma from "./prisma"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  
  // Verify user still exists in the database (prevents Foreign Key crash if DB is wiped but cookie remains)
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) {
    redirect("/login")
  }
  
  return user
}

// Data Isolation Helper: Only returns budgets for the logged-in user
export async function getUserBudgets() {
  const user = await requireUser()
  
  return prisma.budget.findMany({
    where: {
      userId: user.id
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
}
