import AppLayout from "@/components/Layout/AppLayout"
import { requireUser } from "@/lib/session"
import { getAccounts } from "@/app/actions/accounts"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Ensure the user is logged in
  const user = await requireUser()
  const accounts = await getAccounts()
  
  const prisma = (await import("@/lib/prisma")).default
  const budgets = await prisma.budget.findMany({ where: { userId: user.id } })
  const cookieStore = await (await import("next/headers")).cookies()
  const activeBudgetId = cookieStore.get("activeBudgetId")?.value
  const activeBudget = budgets.find((b: any) => b.id === activeBudgetId) || budgets[0] || null

  return (
    <AppLayout accounts={accounts} budgets={budgets} activeBudget={activeBudget}>
      {children}
    </AppLayout>
  )
}
