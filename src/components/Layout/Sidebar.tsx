"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import AddAccountModal from "../Accounts/AddAccountModal"
import EditAccountModal from "../Accounts/EditAccountModal"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronDown, ChevronsLeft, ChevronsRight, PieChart, 
  Landmark, Wallet, CreditCard, PiggyBank, Plus, 
  MoreHorizontal, Archive, Settings, LogOut, Pencil, Trees, Trash2
} from "lucide-react"
import { formatCurrency } from "@/lib/currency"

export default function Sidebar({ accounts = [], budgets = [], activeBudget = null, externalCollapsed = null }: { accounts?: any[], budgets?: any[], activeBudget?: any, externalCollapsed?: boolean | null }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [accountToEdit, setAccountToEdit] = useState<any>(null)
  const [isBudgetDropdownOpen, setIsBudgetDropdownOpen] = useState(false)
  const [showBudgetAccounts, setShowBudgetAccounts] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    if (!activeBudget) return
    try {
      const res = await fetch(`/api/export?budgetId=${activeBudget.id}`)
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ynab-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setIsBudgetDropdownOpen(false)
    } catch (e) {
      alert("Failed to export data")
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!res.ok) throw new Error('Import failed')
      
      const newBudget = await res.json()
      // Switch to the newly imported budget
      const { switchBudget } = await import("@/app/actions/budget")
      await switchBudget(newBudget.id)
      
      alert("Budget imported successfully!")
      setIsBudgetDropdownOpen(false)
      window.location.reload() // Force full reload to refresh all data globally
    } catch (e) {
      alert("Failed to import budget. Please check the file format.")
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
        className="flex flex-col bg-[#232262] text-white flex-shrink-0 relative z-10 h-full"
        style={{ minHeight: '100vh' }}
      >
        {/* Budget Switcher Header */}
        <div className="flex items-center justify-between h-[72px] px-4 border-b border-white/10 relative">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <div className="relative w-full">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => setIsBudgetDropdownOpen(!isBudgetDropdownOpen)}
                  className="flex items-center gap-2.5 cursor-pointer hover:text-gray-300 transition-colors w-full"
                >
                  <Trees size={26} className="text-white shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-extrabold text-[17px] truncate leading-tight tracking-wide">{activeBudget?.name || "Satyam's Plan"}</span>
                    <span className="text-[11px] text-white/70 font-medium truncate">{session?.user?.email || "123102033@nitkkr.ac.in"}</span>
                  </div>
                  <ChevronDown size={16} className={`transition-transform duration-200 shrink-0 text-white/80 ${isBudgetDropdownOpen ? 'rotate-180' : ''}`} />
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
                        <div key={b.id} className={`flex items-center justify-between w-full px-4 py-2 hover:bg-slate-50 group/budget ${b.id === activeBudget?.id ? 'bg-blue-50' : ''}`}>
                          <button 
                            onClick={async () => {
                              const { switchBudget } = await import("@/app/actions/budget")
                              await switchBudget(b.id)
                              setIsBudgetDropdownOpen(false)
                            }}
                            className={`flex-1 text-left text-sm font-medium ${b.id === activeBudget?.id ? 'text-[#005A87]' : 'text-slate-800'}`}
                          >
                            {b.name}
                          </button>
                          <div className="flex items-center opacity-0 group-hover/budget:opacity-100 transition-opacity gap-1">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newName = window.prompt("Enter new budget name:", b.name);
                                if (newName && newName !== b.name) {
                                  const { renameBudget } = await import("@/app/actions/budget");
                                  await renameBudget(b.id, newName);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              title="Rename budget"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to delete the budget "${b.name}"? This cannot be undone.`)) {
                                  const { deleteBudget } = await import("@/app/actions/budget");
                                  await deleteBudget(b.id);
                                  if (b.id === activeBudget?.id) {
                                    setIsBudgetDropdownOpen(false);
                                  }
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                              title="Delete budget"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
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
                        <button 
                          onClick={handleExport}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center gap-2"
                        >
                          Export Data (JSON)
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isImporting}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center gap-2 disabled:opacity-50"
                        >
                          {isImporting ? 'Importing...' : 'Import Data (JSON)'}
                        </button>
                        <input 
                          type="file" 
                          accept=".json" 
                          ref={fileInputRef} 
                          onChange={handleImport} 
                          className="hidden" 
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col py-3 gap-1">
          <Link href="/budget" className={`flex items-center px-4 py-2.5 mx-2 rounded-lg transition-all text-[15px] ${isActive("/budget") ? "bg-[#3B42A4] text-white font-bold shadow-sm" : "text-white font-bold hover:bg-white/10"}`}>
            <Wallet size={20} className={isCollapsed ? "mx-auto" : "mr-3"} />
            {!isCollapsed && <span>Plan</span>}
          </Link>
          <Link href="/reports" className={`flex items-center px-4 py-2.5 mx-2 rounded-lg transition-all text-[15px] ${isActive("/reports") ? "bg-[#3B42A4] text-white font-bold shadow-sm" : "text-white font-bold hover:bg-white/10"}`}>
            <PieChart size={20} className={isCollapsed ? "mx-auto" : "mr-3"} />
            {!isCollapsed && <span>Reflect</span>}
          </Link>
          <Link href="/accounts" className={`flex items-center px-4 py-2.5 mx-2 rounded-lg transition-all text-[15px] ${isActive("/accounts") ? "bg-[#3B42A4] text-white font-bold shadow-sm" : "text-white font-bold hover:bg-white/10"}`}>
            <Landmark size={20} className={isCollapsed ? "mx-auto" : "mr-3"} />
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
                className="w-full flex justify-between items-center px-5 py-2 text-xs font-bold tracking-[0.1em] text-white hover:text-gray-200 transition-colors uppercase"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronDown size={12} className={`transition-transform duration-200 ${showBudgetAccounts ? '' : '-rotate-90'}`} />
                  Cash
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
                        className={`group flex justify-between items-center px-5 py-2.5 transition-all ${
                          pathname === `/accounts/${acc.id}` 
                            ? 'bg-white/10 text-white font-bold text-[13px]' 
                            : 'text-white/90 hover:bg-white/5 hover:text-white font-bold text-[13px]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate mr-2 flex-1 pl-4">
                          <span className="truncate">{acc.name}</span>
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.preventDefault(); setAccountToEdit(acc); }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                          >
                            <Pencil size={12} className="text-white/60 hover:text-white" />
                          </button>
                          {acc.balance < 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-white text-[#E54545] font-bold text-[12px] shrink-0 tabular-nums">
                              {formatCurrency(acc.balance)}
                            </span>
                          ) : (
                            <span className="text-[13px] font-bold text-white shrink-0 tabular-nums">
                              {formatCurrency(acc.balance)}
                            </span>
                          )}
                        </div>
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
                  className="w-full flex justify-between items-center px-5 py-2 text-xs font-bold tracking-[0.1em] text-white hover:text-gray-200 transition-colors uppercase"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showCCAccounts ? '' : '-rotate-90'}`} />
                    Credit
                  </span>
                  <span>{formatCurrency(ccTotal)}</span>
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
                          className={`group flex justify-between items-center px-5 py-2.5 transition-all ${
                            pathname === `/accounts/${acc.id}` 
                              ? 'bg-white/10 text-white font-bold text-[13px]' 
                              : 'text-white/90 hover:bg-white/5 hover:text-white font-bold text-[13px]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 truncate mr-2 flex-1 pl-4">
                            <span className="truncate">{acc.name}</span>
                          </span>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.preventDefault(); setAccountToEdit(acc); }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                            >
                              <Pencil size={12} className="text-white/60 hover:text-white" />
                            </button>
                            {acc.balance < 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-white text-[#E54545] font-bold text-[12px] shrink-0 tabular-nums">
                                {formatCurrency(acc.balance)}
                              </span>
                            ) : (
                              <span className="text-[13px] font-bold text-white shrink-0 tabular-nums">
                                {formatCurrency(acc.balance)}
                              </span>
                            )}
                          </div>
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
                  className="w-full flex justify-between items-center px-5 py-2 text-xs font-bold tracking-[0.1em] text-white/60 hover:text-white/80 transition-colors uppercase"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showClosedAccounts ? '' : '-rotate-90'}`} />
                    Closed
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
                          className="group flex justify-between items-center px-5 py-2 text-sm text-white/30 hover:bg-white/5 transition-all"
                        >
                          <span className="flex items-center gap-2.5 truncate mr-2 flex-1">
                            {getAccountIcon(acc.type)}
                            <span className="truncate line-through">{acc.name}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.preventDefault(); setAccountToEdit(acc); }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                            >
                              <Pencil size={12} className="text-white/60 hover:text-white" />
                            </button>
                            <span className="text-xs font-medium shrink-0 tabular-nums">
                              {formatCurrency(acc.balance)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Add Account Buttons */}
            <div className="px-4 mt-6 flex flex-col gap-2 mb-4">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full py-2 bg-[#33399b] hover:bg-[#3B42A4] text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Account
              </button>
            </div>

            {/* Logout Button */}
            <button 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-2 mx-4 py-2 px-3 text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg text-left transition-all flex items-center gap-2"
            >
              <LogOut size={14} />
              Log Out
            </button>

          </motion.div>
        )}

        {/* Bottom Section */}
        <div className="mt-auto flex justify-end p-4 border-t border-white/10">
           <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white"
            >
              {isCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>
        </div>
      </motion.aside>

      <AnimatePresence>
        {isModalOpen && (
          <AddAccountModal onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {accountToEdit && (
          <EditAccountModal 
            account={accountToEdit} 
            onClose={() => setAccountToEdit(null)} 
          />
        )}
      </AnimatePresence>
    </>
  )
}
