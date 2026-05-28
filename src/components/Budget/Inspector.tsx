"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { formatCurrency, CURRENCY_SYMBOL } from "@/lib/currency"

interface InspectorProps {
  categoryData: any
  onUpdateAssigned: (categoryId: string, amount: number) => Promise<void>
  onUpdateTarget: (categoryId: string, targetType: string, target: number) => Promise<void>
  groups?: any[]
}

export default function Inspector({ categoryData, onUpdateAssigned, onUpdateTarget, groups = [] }: InspectorProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false)
  const [editTargetType, setEditTargetType] = useState("NEEDED_FOR_SPENDING")
  const [editTargetAmount, setEditTargetAmount] = useState("")

  if (!categoryData) {
    const totalBudgeted = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + c.assigned, 0), 0)
    const totalActivity = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + c.activity, 0), 0)
    const totalAvailable = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + c.available, 0), 0)
    const totalUnderfunded = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + Math.max(0, (c.target || 0) - c.available), 0), 0)

    const handleAutoAssignAllUnderfunded = () => {
      groups.forEach(g => {
        g.categories.forEach((c: any) => {
          const under = Math.max(0, (c.target || 0) - c.available)
          if (under > 0) {
            onUpdateAssigned(c.id, c.assigned + under)
          }
        })
      })
    }

    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-800">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">Month Summary</h2>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 mb-6">
            <h3 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase mb-3">Auto-Assign</h3>
            <button 
              onClick={handleAutoAssignAllUnderfunded}
              disabled={totalUnderfunded === 0}
              className="w-full flex justify-between items-center px-4 py-2.5 bg-blue-50 text-[#005A87] border border-blue-200 rounded-md font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Underfunded
              <span>{formatCurrency(totalUnderfunded)}</span>
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 text-center">
              Assign money to all underfunded categories at once.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400 dark:text-slate-500">Total Budgeted</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(totalBudgeted)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400 dark:text-slate-500">Total Activity</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(totalActivity)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400 dark:text-slate-500">Total Available</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(totalAvailable)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate underfunded amount
  const underfunded = Math.max(0, (categoryData.target || 0) - categoryData.available)
  const targetProgress = categoryData.target > 0 ? Math.min(100, (categoryData.available / categoryData.target) * 100) : 0

  const handleAutoAssignUnderfunded = () => {
    if (underfunded > 0) {
      onUpdateAssigned(categoryData.id, categoryData.assigned + underfunded)
    }
  }

  const handleSaveTarget = async () => {
    const amountInPaise = Math.round(parseFloat(editTargetAmount || "0") * 100)
    await onUpdateTarget(categoryData.id, editTargetType, amountInPaise)
    setIsEditingTarget(false)
  }

  const handleDeleteTarget = async () => {
    await onUpdateTarget(categoryData.id, "NEEDED_FOR_SPENDING", 0)
    setIsEditingTarget(false)
  }

  const openTargetEditor = () => {
    setEditTargetType(categoryData.targetType || "NEEDED_FOR_SPENDING")
    setEditTargetAmount(categoryData.target ? (categoryData.target / 100).toFixed(2) : "")
    setIsEditingTarget(true)
  }

  const renderTargetDisplay = () => {
    if (!categoryData.target || categoryData.target === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center">No target set for this category.</div>
          <button 
            onClick={openTargetEditor}
            className="px-4 py-2 text-sm font-medium text-[#005a70] border border-[#005a70] rounded-md hover:bg-[#005a70] hover:text-white transition-colors"
          >
            Create Target
          </button>
        </div>
      )
    }

    const typeLabel = categoryData.targetType === "NEEDED_FOR_SPENDING" ? "Needed For Spending" : "Savings Builder"

    return (
      <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500">{typeLabel}</span>
          <button onClick={openTargetEditor} className="text-sm font-medium text-[#005a70] hover:underline">Edit</button>
        </div>
        <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
          {formatCurrency(categoryData.target)} 
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${targetProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full rounded-full ${targetProgress >= 100 ? 'bg-[#23B573]' : 'bg-[#E8A317]'}`}
          />
        </div>
        
        <div className={`text-sm font-semibold ${underfunded > 0 ? 'text-[#E8A317]' : 'text-[#23B573]'}`}>
          {underfunded > 0 ? `${formatCurrency(underfunded)} to go` : 'Fully Funded!'}
        </div>
        
        <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 flex justify-center">
          <button className="text-sm font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-200 transition-colors">
            Snooze Target
          </button>
        </div>
      </div>
    )
  }

  const renderTargetEditor = () => {
    return (
      <div className="flex flex-col gap-4 p-4 bg-white dark:bg-slate-900 border border-blue-200 rounded-lg shadow-md ring-1 ring-blue-100">
        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Target Settings</h4>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wider">Target Type</label>
          <select 
            value={editTargetType}
            onChange={(e) => setEditTargetType(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400"
          >
            <option value="NEEDED_FOR_SPENDING">Needed For Spending</option>
            <option value="SAVINGS_BUILDER">Savings Builder</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wider">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-slate-400 dark:text-slate-500">{CURRENCY_SYMBOL}</span>
            <input 
              type="number" 
              step="0.01"
              value={editTargetAmount}
              onChange={(e) => setEditTargetAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400" 
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={handleDeleteTarget}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Delete Target
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsEditingTarget(false)}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 dark:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveTarget}
              className="px-3 py-1.5 text-sm font-medium text-white bg-[#005a70] rounded hover:bg-[#004252] transition-colors"
            >
              Save Target
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={categoryData.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col p-6 gap-6"
      >
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{categoryData.name}</h2>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Assigned</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{formatCurrency(categoryData.assigned)}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Activity</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{formatCurrency(categoryData.activity)}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Available</span>
            <span className={`text-sm font-bold mt-1 ${categoryData.available > 0 ? 'text-[#23B573]' : categoryData.available < 0 ? 'text-[#E54545]' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}>
              {formatCurrency(categoryData.available)}
            </span>
          </div>
        </div>

        {/* Auto-Assign Section */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">Auto-Assign</h3>
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleAutoAssignUnderfunded}
              disabled={underfunded === 0}
              className="flex justify-between items-center px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-[#005a70] hover:shadow transition-all disabled:opacity-50 disabled:hover:border-slate-200 dark:border-slate-700 disabled:cursor-not-allowed group"
            >
              <span className="font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 group-hover:text-[#005a70] transition-colors">Underfunded</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(underfunded)}</span>
            </button>
            <button 
              onClick={() => onUpdateAssigned(categoryData.id, categoryData.assigned + (categoryData.assignedLastMonth || 0))}
              disabled={!categoryData.assignedLastMonth}
              className="flex justify-between items-center px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-[#005a70] hover:shadow transition-all disabled:opacity-50 disabled:hover:border-slate-200 dark:border-slate-700 disabled:cursor-not-allowed group"
            >
              <span className="font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 group-hover:text-[#005a70] transition-colors">Assigned Last Month</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(categoryData.assignedLastMonth || 0)}</span>
            </button>
            <button 
              onClick={() => onUpdateAssigned(categoryData.id, categoryData.assigned + (categoryData.spentLastMonth || 0))}
              disabled={!categoryData.spentLastMonth}
              className="flex justify-between items-center px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-[#005a70] hover:shadow transition-all disabled:opacity-50 disabled:hover:border-slate-200 dark:border-slate-700 disabled:cursor-not-allowed group"
            >
              <span className="font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 group-hover:text-[#005a70] transition-colors">Spent Last Month</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(categoryData.spentLastMonth || 0)}</span>
            </button>
            <button 
              onClick={() => onUpdateAssigned(categoryData.id, 0)}
              disabled={categoryData.assigned === 0}
              className="flex justify-between items-center px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-red-400 hover:shadow transition-all disabled:opacity-50 disabled:hover:border-slate-200 dark:border-slate-700 disabled:cursor-not-allowed group"
            >
              <span className="font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 group-hover:text-red-500 transition-colors">Reset Assigned</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(categoryData.assigned)}</span>
            </button>
          </div>
        </div>

        {/* Target Section */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">Target</h3>
          {isEditingTarget ? renderTargetEditor() : renderTargetDisplay()}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
