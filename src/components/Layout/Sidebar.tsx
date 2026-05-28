"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import AddAccountModal from "../Accounts/AddAccountModal"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronDown, ChevronsLeft, ChevronsRight, PieChart, 
  Landmark, Wallet, CreditCard, PiggyBank, Plus, 
  MoreHorizontal, Archive, Settings, LogOut
} from "lucide-react"
import { formatCurrency } from "@/lib/currency"

export default function Sidebar({ accounts = [], budgets = [], activeBudget = null, externalCollapsed = null }: { accounts?: any[], budgets?: any[], activeBudget?: any, externalCollapsed?: boolean | null }) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBudgetDropdownOpen, setIsBudgetDropdownOpen] = useState(false)
  const [showBudgetAccounts, setShowBudgetAccounts] = useState(true)

  React.useEffect(() => {
    if (externalCollapsed !== null && externalCollapsed !== undefined) {
      setIsCollapsed(prev => !prev)
    }
  }, [externalCollapsed])
  const [showCCAccounts, setShowCCAccounts] = useState(true)
  const [showClosedAccounts, setShowClosedAccounts] = useState(false)

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'creditCard': return <CreditCard size={15} />
      case 'savings': return <PiggyBank size={15} />
      default: return <Landmark size={15} />
    }
  }

  // Split accounts into groups
  const budgetAccounts = accounts.filter(a => a.type !== 'creditCard' && !a.isClosed)
  const creditCardAccounts = accounts.filter(a => a.type === 'creditCard' && !a.isClosed)
  const closedAccounts = accounts.filter(a => a.isClosed)

  const budgetTotal = budgetAccounts.reduce((sum, a) => sum + a.balance, 0)
  const ccTotal = creditCardAccounts.reduce((sum, a) => sum + a.balance, 0)
  const totalBalance = accounts.filter(a => !a.isClosed).reduce((sum, a) => sum + a.balance, 0)

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/')

  return (
    <>
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 64 : 260 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex flex-col bg-[#003F5E] text-white flex-shrink-0 relative z-10 h-full"
        style={{ minHeight: '100vh' }}
      >
        {/* Budget Switcher Header */}
        <div className="flex items-center justify-between h-[72px] px-4 border-b border-white/10 relative">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <div className="relative">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => setIsBudgetDropdownOpen(!isBudgetDropdownOpen)}
                  className="flex items-center gap-2 cursor-pointer hover:text-gray-300 transition-colors"
                >
                  <span className="font-bold text-base truncate max-w-[160px]">{activeBudget?.name || "My Budget"}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isBudgetDropdownOpen ? 'rotate-180' : ''}`} />
                </motion.div>
                
                <AnimatePresence>
                  {isBudgetDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-2 z-50 text-slate-800 border border-slate-200"
                    >
                      <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Switch Budget</div>
                      {budgets.map(b => (
                        <button 
                          key={b.id} 
                          onClick={async () => {
                            const { switchBudget } = await import("@/app/actions/budget")
                            await switchBudget(b.id)
                            setIsBudgetDropdownOpen(false)
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-medium ${b.id === activeBudget?.id ? 'text-[#005A87] bg-blue-50' : ''}`}
                        >
                          {b.name}
                        </button>
                      ))}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button 
                          onClick={async () => {
                            const name = window.prompt("Enter new budget name:")
                            if (name) {
                              const { createBudget } = await import("@/app/actions/budget")
                              await createBudget(name)
                              setIsBudgetDropdownOpen(false)
                            }
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-medium text-[#005A87]"
                        >
                          + Create New Budget
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white"
          >
            {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col py-3 gap-0.5">
          <Link href="/budget" className={`flex items-center px-4 py-2.5 transition-all text-sm ${isActive("/budget") ? "bg-white/10 border-l-3 border-[#23B573] text-white font-semibold" : "border-l-3 border-transparent text-white/70 hover:bg-white/5 hover:text-white"}`}>
            <Wallet size={18} className={isCollapsed ? "mx-auto" : "mr-3"} />
            {!isCollapsed && <span>Budget</span>}
          </Link>
          <Link href="/reports" className={`flex items-center px-4 py-2.5 transition-all text-sm ${isActive("/reports") ? "bg-white/10 border-l-3 border-[#23B573] text-white font-semibold" : "border-l-3 border-transparent text-white/70 hover:bg-white/5 hover:text-white"}`}>
            <PieChart size={18} className={isCollapsed ? "mx-auto" : "mr-3"} />
            {!isCollapsed && <span>Reports</span>}
          </Link>
          <Link href="/accounts" className={`flex items-center px-4 py-2.5 transition-all text-sm ${isActive("/accounts") ? "bg-white/10 border-l-3 border-[#23B573] text-white font-semibold" : "border-l-3 border-transparent text-white/70 hover:bg-white/5 hover:text-white"}`}>
            <Landmark size={18} className={isCollapsed ? "mx-auto" : "mr-3"} />
            {!isCollapsed && <span>All Accounts</span>}
          </Link>
        </nav>

        {/* Account Lists */}
        {!isCollapsed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col overflow-y-auto"
          >
            {/* Bank Accounts Section */}
            <div className="mt-4">
              <button 
                onClick={() => setShowBudgetAccounts(!showBudgetAccounts)}
                className="w-full flex justify-between items-center px-5 py-2 text-[11px] font-bold tracking-wider text-white/40 hover:text-white/60 transition-colors uppercase"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronDown size={12} className={`transition-transform duration-200 ${showBudgetAccounts ? '' : '-rotate-90'}`} />
                  Bank Accounts
                </span>
                <span>{formatCurrency(budgetTotal)}</span>
              </button>
              
              <AnimatePresence>
                {showBudgetAccounts && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    {budgetAccounts.map(acc => (
                      <Link 
                        href={`/accounts/${acc.id}`} 
                        key={acc.id} 
                        className={`flex justify-between items-center px-5 py-2 text-sm transition-all ${
                          pathname === `/accounts/${acc.id}` 
                            ? 'bg-white/10 text-white' 
                            : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate mr-2">
                          {getAccountIcon(acc.type)}
                          <span className="truncate">{acc.name}</span>
                        </span>
                        <span className={`text-xs font-medium shrink-0 tabular-nums ${acc.balance < 0 ? 'text-red-400' : ''}`}>
                          {formatCurrency(acc.balance)}
                        </span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Credit Card Accounts Section */}
            {creditCardAccounts.length > 0 && (
              <div className="mt-2">
                <button 
                  onClick={() => setShowCCAccounts(!showCCAccounts)}
                  className="w-full flex justify-between items-center px-5 py-2 text-[11px] font-bold tracking-wider text-white/40 hover:text-white/60 transition-colors uppercase"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showCCAccounts ? '' : '-rotate-90'}`} />
                    Credit Cards
                  </span>
                  <span className={ccTotal < 0 ? 'text-red-400' : ''}>{formatCurrency(ccTotal)}</span>
                </button>
                
                <AnimatePresence>
                  {showCCAccounts && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {creditCardAccounts.map(acc => (
                        <Link 
                          href={`/accounts/${acc.id}`} 
                          key={acc.id} 
                          className={`flex justify-between items-center px-5 py-2 text-sm transition-all ${
                            pathname === `/accounts/${acc.id}` 
                              ? 'bg-white/10 text-white' 
                              : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 truncate mr-2">
                            <CreditCard size={15} />
                            <span className="truncate">{acc.name}</span>
                          </span>
                          <span className={`text-xs font-medium shrink-0 tabular-nums ${acc.balance < 0 ? 'text-red-400' : ''}`}>
                            {formatCurrency(acc.balance)}
                          </span>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Closed Accounts */}
            {closedAccounts.length > 0 && (
              <div className="mt-2">
                <button 
                  onClick={() => setShowClosedAccounts(!showClosedAccounts)}
                  className="w-full flex justify-between items-center px-5 py-2 text-[11px] font-bold tracking-wider text-white/30 hover:text-white/50 transition-colors uppercase"
                >
                  <span className="flex items-center gap-1.5">
                    <Archive size={12} />
                    Closed ({closedAccounts.length})
                  </span>
                </button>
                <AnimatePresence>
                  {showClosedAccounts && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {closedAccounts.map(acc => (
                        <Link 
                          href={`/accounts/${acc.id}`} 
                          key={acc.id} 
                          className="flex justify-between items-center px-5 py-2 text-sm text-white/30 hover:bg-white/5 transition-all"
                        >
                          <span className="flex items-center gap-2.5 truncate mr-2">
                            {getAccountIcon(acc.type)}
                            <span className="truncate line-through">{acc.name}</span>
                          </span>
                          <span className="text-xs font-medium shrink-0 tabular-nums">
                            {formatCurrency(acc.balance)}
                          </span>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Add Account Button */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-3 mx-4 py-2 px-3 text-sm font-medium text-white/40 hover:text-white hover:bg-white/10 rounded-lg text-left transition-all flex items-center gap-2"
            >
              <Plus size={14} />
              Add Account
            </button>

            {/* Logout Button */}
            <button 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-3 mx-4 py-2 px-3 text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg text-left transition-all flex items-center gap-2"
            >
              <LogOut size={14} />
              Log Out
            </button>

            {/* Footer with total */}
            <div className="mt-auto px-5 py-3 border-t border-white/10 text-xs text-white/40 flex justify-between">
              <span>Total</span>
              <span className={`font-semibold ${totalBalance < 0 ? 'text-red-400' : 'text-white/60'}`}>
                {formatCurrency(totalBalance)}
              </span>
            </div>
          </motion.div>
        )}
      </motion.aside>

      <AnimatePresence>
        {isModalOpen && (
          <AddAccountModal onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
