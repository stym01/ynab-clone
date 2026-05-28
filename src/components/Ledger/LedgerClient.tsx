"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createTransaction, toggleTransactionCleared, deleteTransaction, flagTransaction } from "@/app/actions/accounts"
import ReconcileModal from "./ReconcileModal"
import { formatCurrency, CURRENCY_SYMBOL } from "@/lib/currency"
import { Flag, Trash2, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface LedgerClientProps {
  account: any
  categories: any[]
  payees: any[]
}

const FLAG_COLORS = [
  { name: 'red', color: '#E54545' },
  { name: 'orange', color: '#F97316' },
  { name: 'yellow', color: '#E8A317' },
  { name: 'green', color: '#23B573' },
  { name: 'blue', color: '#3B82F6' },
  { name: 'purple', color: '#8B5CF6' },
]

export default function LedgerClient({ account, categories, payees }: LedgerClientProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [flagMenuId, setFlagMenuId] = useState<string | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()
  
  const [pendingFlagAction, setPendingFlagAction] = useState(false)

  // Auto-refresh polling to provide a real-time UI feel for webhooks
  React.useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if the user is actively looking at the tab to save resources
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }, 4000); // 4 seconds
    return () => clearInterval(interval);
  }, [router]);
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key.toLowerCase() === 'e' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setIsReconciling(true)
        return
      }

      if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedIds(new Set(filteredTransactions.map((t: any) => t.id)))
        return
      }
      
      if (e.key === 'Escape') {
        setSelectedIds(new Set())
        return
      }

      if (e.key.toLowerCase() === 'f' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault()
        handleBulkDelete()
        setPendingFlagAction(false)
        return
      }

      if (e.key === 'N' && e.shiftKey) {
        e.preventDefault()
        setIsAdding(true)
        setPendingFlagAction(false)
        return
      }

      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
        if (selectedIds.size > 0) {
          e.preventDefault()
          const firstId = Array.from(selectedIds)[0]
          const firstTx = account.transactions.find((t: any) => t.id === firstId)
          if (firstTx) {
            const newClearedStatus = !firstTx.cleared
            selectedIds.forEach(id => toggleTransactionCleared(id, newClearedStatus))
          }
        }
        setPendingFlagAction(false)
        return
      }

      if (e.key === 'F' && e.shiftKey) {
        e.preventDefault()
        if (selectedIds.size > 0) {
          setPendingFlagAction(true)
        }
        return
      }

      if (pendingFlagAction) {
        const flagKeyMap: Record<string, string | null> = {
          '0': null, '1': 'red', '2': 'orange', '3': 'yellow', '4': 'green', '5': 'blue', '6': 'purple'
        }
        if (flagKeyMap[e.key] !== undefined) {
          e.preventDefault()
          const color = flagKeyMap[e.key]
          selectedIds.forEach(id => flagTransaction(id, color))
          setPendingFlagAction(false)
        } else if (e.key !== 'Shift') {
          setPendingFlagAction(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, account.transactions, pendingFlagAction])
  
  // New transaction state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [payeeName, setPayeeName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [memo, setMemo] = useState("")
  const [outflow, setOutflow] = useState("")
  const [inflow, setInflow] = useState("")
  const [splits, setSplits] = useState([{ categoryId: "", memo: "", amount: "" }, { categoryId: "", memo: "", amount: "" }])

  const handleSaveTransaction = async () => {
    if (!payeeName) return
    setIsSaving(true)
    const outAmt = parseFloat(outflow || "0")
    const inAmt = parseFloat(inflow || "0")
    const amountCents = outAmt > 0 ? -Math.round(outAmt * 100) : Math.round(inAmt * 100)

    let subTransactions = undefined
    if (categoryId === "SPLIT") {
      subTransactions = splits.filter(s => parseFloat(s.amount) > 0).map(s => ({
        categoryId: s.categoryId === "" ? null : s.categoryId,
        amountCents: outAmt > 0 ? -Math.round(parseFloat(s.amount) * 100) : Math.round(parseFloat(s.amount) * 100),
        memo: s.memo
      }))
    }

    await createTransaction({
      accountId: account.id,
      categoryId: categoryId === "SPLIT" || categoryId === "" ? null : categoryId,
      date: new Date(date),
      amountCents,
      payeeName,
      memo,
      subTransactions
    })

    setPayeeName(""); setCategoryId(""); setMemo(""); setOutflow(""); setInflow("")
    setSplits([{ categoryId: "", memo: "", amount: "" }, { categoryId: "", memo: "", amount: "" }])
    setIsAdding(false); setIsSaving(false)
  }

  const handleDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['+', '-', 't', 'T', 'm', 'M', 'y', 'Y'].includes(e.key)) {
      e.preventDefault()
      const d = new Date(date)
      if (isNaN(d.getTime())) return

      if (e.key === '+') d.setDate(d.getDate() + 1)
      if (e.key === '-') d.setDate(d.getDate() - 1)
      if (e.key.toLowerCase() === 't') {
        const today = new Date()
        d.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
      }
      if (e.key === 'm') d.setDate(1)
      if (e.key === 'M') d.setMonth(d.getMonth() + 1, 0)
      if (e.key === 'y') d.setMonth(0, 1)
      if (e.key === 'Y') d.setMonth(11, 31)
      
      const tzOffset = d.getTimezoneOffset() * 60000; 
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, -1);
      setDate(localISOTime.split('T')[0])
    }
  }

  const handleCreateAdjustment = async (amountCents: number) => {
    await createTransaction({
      accountId: account.id, categoryId: null, date: new Date(),
      amountCents, payeeName: "Manual Balance Adjustment", memo: "Reconciliation Adjustment"
    })
  }

  const categoriesByGroup = categories.reduce((acc, cat) => {
    if (!acc[cat.groupId]) acc[cat.groupId] = []
    acc[cat.groupId].push(cat)
    return acc
  }, {} as Record<string, any[]>)

  const clearedBalance = account.transactions.filter((t: any) => t.cleared).reduce((sum: number, t: any) => sum + t.amount, 0)
  const unclearedBalance = account.transactions.filter((t: any) => !t.cleared).reduce((sum: number, t: any) => sum + t.amount, 0)

  // Compute running balance (most recent first, so we go backwards)
  const runningBalances = useMemo(() => {
    const balances: Record<string, number> = {}
    let running = 0
    const sorted = [...account.transactions].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    for (const t of sorted) {
      running += t.amount
      balances[t.id] = running
    }
    return balances
  }, [account.transactions])

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return account.transactions
    const q = searchQuery.toLowerCase()
    return account.transactions.filter((t: any) => 
      t.payee?.name?.toLowerCase().includes(q) ||
      t.category?.name?.toLowerCase().includes(q) ||
      t.memo?.toLowerCase().includes(q)
    )
  }, [account.transactions, searchQuery])

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  const toggleSelect = (id: string, isShift: boolean = false) => {
    const next = new Set(selectedIds)
    if (isShift && lastSelectedId) {
      const currentIndex = filteredTransactions.findIndex((t: any) => t.id === id)
      const lastIndex = filteredTransactions.findIndex((t: any) => t.id === lastSelectedId)
      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex)
        const end = Math.max(currentIndex, lastIndex)
        for (let i = start; i <= end; i++) {
          next.add(filteredTransactions[i].id)
        }
      }
    } else {
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setLastSelectedId(id)
    }
    setSelectedIds(next)
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} transaction(s)?`)) return
    for (const id of selectedIds) {
      await deleteTransaction(id)
    }
    setSelectedIds(new Set())
  }

  // Category select dropdown
  const CategorySelect = ({ value, onChange, disabled, className }: any) => (
    <select value={value} onChange={onChange} disabled={disabled} className={className}>
      {disabled ? (
        <option value="">Category not needed</option>
      ) : (
        <>
          <option value="">Ready to Assign</option>
          <option value="SPLIT" className="font-bold text-blue-600 bg-blue-50">Split (Multiple Categories)</option>
          {Object.entries(categoriesByGroup).map(([groupId, cats]: [string, any]) => (
            <optgroup key={groupId} label={cats[0].group?.name || 'Group'}>
              {cats.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </>
      )}
    </select>
  )

  return (
    <div className="flex flex-col h-full bg-white flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white z-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-slate-800">{account.name}</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAdding(true)}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-[#005A87] rounded-lg hover:bg-[#004566] transition-all active:scale-[0.98] shadow-sm"
            >
              + Add Transaction
            </button>
            <button 
              onClick={() => setIsReconciling(true)}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
            >
              Reconcile
            </button>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cleared</span>
            <span className="text-lg font-semibold text-[#23B573] tabular-nums">{formatCurrency(clearedBalance)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Uncleared</span>
            <span className="text-lg font-medium text-slate-400 tabular-nums">{formatCurrency(unclearedBalance)}</span>
          </div>
          <div className="flex flex-col items-end pl-4 border-l border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Working</span>
            <span className="text-lg font-bold text-slate-800 tabular-nums">{formatCurrency(account.balance)}</span>
          </div>
        </div>
      </div>

      {/* Search / Bulk Actions Bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 focus:border-[#005A87] bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs font-semibold text-slate-500">{selectedIds.size} selected</span>
            <button onClick={handleBulkDelete} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
          </motion.div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] text-slate-500 uppercase bg-white sticky top-0 border-b border-slate-200 z-10">
            <tr>
              <th className="px-3 py-2.5 font-semibold w-8"></th>
              <th className="px-3 py-2.5 font-semibold w-8 text-center">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 accent-[#005A87]"
                  checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(filteredTransactions.map((t: any) => t.id)))
                    else setSelectedIds(new Set())
                  }}
                />
              </th>
              <th className="px-3 py-2.5 font-semibold w-10 text-center">✓</th>
              <th className="px-3 py-2.5 font-semibold w-28">Date</th>
              <th className="px-3 py-2.5 font-semibold">Payee</th>
              <th className="px-3 py-2.5 font-semibold">Category</th>
              <th className="px-3 py-2.5 font-semibold">Memo</th>
              <th className="px-3 py-2.5 font-semibold text-right w-28">Outflow</th>
              <th className="px-3 py-2.5 font-semibold text-right w-28">Inflow</th>
              <th className="px-3 py-2.5 font-semibold text-right w-28">Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* Add Transaction Row */}
            <AnimatePresence>
              {isAdding && (
                <>
                  <motion.tr 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-blue-50/80 border-b border-blue-100 border-l-3 border-l-[#005A87]"
                  >
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-center">
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 mx-auto flex items-center justify-center text-[10px] font-bold text-slate-300">U</div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} onKeyDown={handleDateKeyDown} className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 focus:border-[#005A87] text-sm bg-white" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={payeeName} onChange={e => setPayeeName(e.target.value)} list="payees-list" placeholder="Payee" className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 focus:border-[#005A87] bg-white" />
                      <datalist id="payees-list">{payees.map(p => <option key={p.id} value={p.name} />)}</datalist>
                    </td>
                    <td className="px-3 py-2">
                      <CategorySelect 
                        value={payeeName.startsWith("Transfer: ") ? "" : categoryId}
                        onChange={(e: any) => setCategoryId(e.target.value)}
                        disabled={payeeName.startsWith("Transfer: ")}
                        className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 focus:border-[#005A87] disabled:bg-slate-100 disabled:text-slate-400 bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 focus:border-[#005A87] bg-white" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" value={outflow} onChange={e => { setOutflow(e.target.value); setInflow(""); }} placeholder="0.00" className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 text-right bg-white" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" value={inflow} onChange={e => { setInflow(e.target.value); setOutflow(""); }} placeholder="0.00" className="w-full px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 text-right bg-white" />
                    </td>
                    <td className="px-3 py-2">
                      {categoryId !== "SPLIT" && (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => setIsAdding(false)} className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors">Cancel</button>
                          <button onClick={handleSaveTransaction} className="px-3 py-1 text-xs font-medium text-white bg-[#23B573] rounded-md hover:bg-[#1da366] transition-colors shadow-sm">Save</button>
                        </div>
                      )}
                    </td>
                  </motion.tr>

                  {/* Split Rows */}
                  {categoryId === "SPLIT" && splits.map((split, index) => (
                    <tr key={`split-${index}`} className="bg-slate-50/80 border-b border-slate-100">
                      <td colSpan={5}></td>
                      <td className="px-3 py-1.5">
                        <select value={split.categoryId} onChange={e => { const ns = [...splits]; ns[index].categoryId = e.target.value; setSplits(ns) }} className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white">
                          <option value="">Ready to Assign</option>
                          {Object.entries(categoriesByGroup).map(([groupId, cats]: [string, any]) => (
                            <optgroup key={groupId} label={cats[0].group?.name || 'Group'}>
                              {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="text" value={split.memo} onChange={e => { const ns = [...splits]; ns[index].memo = e.target.value; setSplits(ns) }} placeholder="Split memo" className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" step="0.01" value={split.amount} onChange={e => { const ns = [...splits]; ns[index].amount = e.target.value; setSplits(ns) }} className="w-full px-2 py-1 border border-slate-200 rounded text-right text-xs bg-white" />
                      </td>
                      <td className="px-3 py-1.5">
                        {index === splits.length - 1 && (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setSplits([...splits, { categoryId: "", memo: "", amount: "" }])} className="px-2 py-0.5 text-[10px] font-medium text-[#005A87] bg-blue-50 rounded hover:bg-blue-100">+ Split</button>
                            <button onClick={handleSaveTransaction} className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#23B573] rounded hover:bg-[#1da366]">Save</button>
                          </div>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  ))}
                </>
              )}
            </AnimatePresence>

            {/* Existing Transactions */}
            {filteredTransactions.map((t: any, index: number) => (
              <React.Fragment key={t.id}>
                <tr className={`group cursor-pointer transition-all border-b border-slate-50 ${
                  selectedIds.has(t.id) 
                    ? 'bg-blue-50/60' 
                    : index % 2 === 0 
                      ? 'bg-white hover:bg-slate-50/80' 
                      : 'bg-[#FAFBFC] hover:bg-slate-50/80'
                }`}>
                  {/* Flag */}
                  <td className="px-3 py-2 relative">
                    <button
                      onClick={() => setFlagMenuId(flagMenuId === t.id ? null : t.id)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                    >
                      {t.flagColor ? (
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FLAG_COLORS.find(f => f.name === t.flagColor)?.color || '#94A3B8' }} />
                      ) : (
                        <Flag size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                    {/* Flag Color Picker */}
                    <AnimatePresence>
                      {flagMenuId === t.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute left-8 top-0 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-50 flex gap-1.5"
                        >
                          {FLAG_COLORS.map(f => (
                            <button key={f.name} onClick={async () => { await flagTransaction(t.id, f.name); setFlagMenuId(null) }} className="w-5 h-5 rounded-full hover:scale-110 transition-transform" style={{ backgroundColor: f.color }} />
                          ))}
                          <button onClick={async () => { await flagTransaction(t.id, null); setFlagMenuId(null) }} className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 hover:scale-110 transition-transform flex items-center justify-center">
                            <X size={10} className="text-slate-400" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                  
                  {/* Checkbox */}
                  <td className="px-3 py-2 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 accent-[#005A87]"
                      checked={selectedIds.has(t.id)}
                      onChange={() => {}}
                      onClick={(e) => toggleSelect(t.id, e.shiftKey)}
                    />
                  </td>

                  {/* Cleared */}
                  <td className="px-3 py-2 text-center" onClick={() => toggleTransactionCleared(t.id, !t.cleared)}>
                    <div className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer ${t.cleared ? 'border-[#23B573] text-[#23B573] bg-[#23B573]/10' : 'border-slate-300 text-slate-300 hover:border-slate-400'}`}>
                      {t.cleared ? '✓' : ''}
                    </div>
                  </td>
                  
                  <td className="px-3 py-2 text-slate-600 tabular-nums text-[13px]">{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 text-[13px]">{t.payee?.name || ''}</td>
                  <td className="px-3 py-2 text-[13px]">
                    {t.subTransactions?.length > 0 ? (
                      <span className="font-semibold text-[#005A87]">Split ({t.subTransactions.length})</span>
                    ) : (
                      t.category?.name || (
                        t.amount < 0 
                          ? <span className="text-red-500 font-semibold flex items-center gap-1">⚠️ Category Needed</span>
                          : <span className="text-slate-400 italic">Ready to Assign</span>
                      )
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-[13px] truncate max-w-[180px]">{t.memo}</td>
                  <td className="px-3 py-2 text-right font-medium text-[13px] tabular-nums">
                    {t.amount < 0 ? <span className="text-[#E54545]">{formatCurrency(Math.abs(t.amount))}</span> : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[13px] tabular-nums">
                    {t.amount >= 0 ? <span className="text-[#23B573]">{formatCurrency(t.amount)}</span> : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700 text-[13px] tabular-nums">
                    {runningBalances[t.id] !== undefined ? formatCurrency(runningBalances[t.id]) : ''}
                  </td>
                </tr>
                {/* Sub-transactions */}
                {t.subTransactions?.map((st: any) => (
                  <tr key={st.id} className="bg-slate-50/50 border-b border-slate-50 text-xs">
                    <td colSpan={5}></td>
                    <td className="px-3 py-1.5 pl-6 text-slate-500 flex items-center gap-2">
                      <div className="w-px h-3 bg-slate-300 -ml-1"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                      {st.category?.name || <span className="italic text-slate-400">Ready to Assign</span>}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 italic">{st.memo}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">
                      {st.amount < 0 ? formatCurrency(Math.abs(st.amount)) : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">
                      {st.amount >= 0 ? formatCurrency(st.amount) : ''}
                    </td>
                    <td></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isReconciling && (
          <ReconcileModal 
            onClose={() => setIsReconciling(false)}
            clearedBalance={clearedBalance}
            accountId={account.id}
            onCreateAdjustment={handleCreateAdjustment}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
