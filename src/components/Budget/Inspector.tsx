"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pencil, ChevronDown, ChevronRight, Zap } from "lucide-react"
import { formatCurrency, CURRENCY_SYMBOL } from "@/lib/currency"

interface InspectorProps {
  categoryData: any
  onUpdateAssigned: (categoryId: string, amount: number) => Promise<void>
  onUpdateTarget: (categoryId: string, targetType: string, target: number) => Promise<void>
  groups?: any[]
  month?: string
}

export default function Inspector({ categoryData, onUpdateAssigned, onUpdateTarget, groups = [], month }: InspectorProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false)
  const [editTargetType, setEditTargetType] = useState("NEEDED_FOR_SPENDING")
  const [editTargetAmount, setEditTargetAmount] = useState("")

  const [isAvailableBalanceOpen, setIsAvailableBalanceOpen] = useState(false)
  const [isTargetOpen, setIsTargetOpen] = useState(false)
  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false)

  if (!categoryData) {
    const totalBudgeted = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + c.assigned, 0), 0)
    const totalActivity = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + c.activity, 0), 0)
    const totalAvailable = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + c.available, 0), 0)
    const totalUnderfunded = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + Math.max(0, (c.target || 0) - c.available), 0), 0)

    const totalTargets = groups.reduce((sum, g) => sum + g.categories.reduce((s: number, c: any) => s + (c.target || 0), 0), 0)

    const dateObj = new Date((month || "2026-05") + "-01T00:00:00")
    const readableMonth = dateObj.toLocaleDateString('en-US', { month: 'long' })

    return (
      <div className="flex flex-col h-full bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <button className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-5 hover:text-slate-600 transition-colors">
            {readableMonth}'s Summary <ChevronDown size={18} strokeWidth={2.5} className="mt-0.5"/>
          </button>
          
          <div className="flex flex-col gap-3 mb-6 pb-6 border-b border-slate-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">Left Over from Last Month</span>
              <span className="font-semibold text-slate-800">{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">Assigned in {readableMonth}</span>
              <span className="font-semibold text-slate-800">{formatCurrency(totalBudgeted)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">Activity</span>
              <span className="font-semibold text-slate-800">{formatCurrency(totalActivity)}</span>
            </div>
            <div className="flex justify-between text-sm mt-3">
              <span className="text-slate-800 font-medium">Available</span>
              <span className="font-semibold text-slate-800">{formatCurrency(totalAvailable)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-[15px] font-medium text-slate-800">Cost to Be Me</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">{readableMonth}'s Targets</span>
              <span className="font-semibold text-slate-800">{formatCurrency(totalTargets)}</span>
            </div>
            <button className="w-full py-2 px-4 bg-[#EEF2FC] text-[#5155C3] rounded-lg text-[15px] font-medium hover:bg-[#E5EAF5] transition-colors mt-2">
              Enter your expected income
            </button>
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <button 
            onClick={() => setIsTargetOpen(!isTargetOpen)}
            className="p-4 flex items-center justify-between w-full hover:bg-slate-50 transition-colors rounded-xl"
          >
            <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              Target {isTargetOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          </button>
          
          <AnimatePresence>
            {isTargetOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <div className="text-sm font-bold text-slate-800 mt-2">
                    How much do you need for {categoryData.name}?
                  </div>
                  <div className="text-[13px] text-slate-600 leading-relaxed">
                    When you create a target, we'll let you know how much money to set aside to stay on track over time.
                  </div>
                  <button 
                    onClick={openTargetEditor}
                    className="self-start mt-2 px-4 py-1.5 bg-[#EEF2FC] text-[#3B42A4] rounded-lg text-sm font-semibold hover:bg-[#E5EAF5] transition-colors"
                  >
                    Create Target
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    }

    const typeLabel = categoryData.targetType === "NEEDED_FOR_SPENDING" ? "Needed For Spending" : "Savings Builder"

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <button 
          onClick={() => setIsTargetOpen(!isTargetOpen)}
          className="p-4 flex items-center justify-between w-full hover:bg-slate-50 transition-colors rounded-xl"
        >
          <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            Target {isTargetOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>

        <AnimatePresence>
          {isTargetOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-slate-100 mt-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">{typeLabel}</span>
                  <button onClick={openTargetEditor} className="text-sm font-medium text-[#005a70] hover:underline">Edit</button>
                </div>
                
                <div className="text-xl font-bold text-slate-800">
                  {formatCurrency(categoryData.target)} 
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${targetProgress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${targetProgress >= 100 ? 'bg-[#23B573]' : 'bg-[#E8A317]'}`}
                  />
                </div>
                
                <div className={`text-[13px] font-semibold ${underfunded > 0 ? 'text-[#E8A317]' : 'text-[#23B573]'}`}>
                  {underfunded > 0 ? `${formatCurrency(underfunded)} to go` : 'Fully Funded!'}
                </div>
                
                <div className="pt-3 mt-1 border-t border-slate-100 flex justify-center">
                  <button className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
                    Snooze Target
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const renderTargetEditor = () => {
    return (
      <div className="flex flex-col gap-4 p-4 bg-white border border-blue-200 rounded-lg shadow-md ring-1 ring-blue-100">
        <h4 className="font-bold text-slate-800 text-sm">Target Settings</h4>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Type</label>
          <select 
            value={editTargetType}
            onChange={(e) => setEditTargetType(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="NEEDED_FOR_SPENDING">Needed For Spending</option>
            <option value="SAVINGS_BUILDER">Savings Builder</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-slate-400">{CURRENCY_SYMBOL}</span>
            <input 
              type="number" 
              step="0.01"
              value={editTargetAmount}
              onChange={(e) => setEditTargetAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm text-slate-700 outline-none focus:border-blue-400" 
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100">
          <button 
            onClick={handleDeleteTarget}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Delete Target
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsEditingTarget(false)}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
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
        className="flex flex-col h-full bg-slate-50 overflow-y-auto"
      >
        <div className="flex flex-col p-6 gap-4">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-bold text-slate-900 flex items-center gap-2">
              {categoryData.name} <Pencil size={14} className="text-slate-400 cursor-pointer hover:text-slate-600" />
            </h2>
          </div>

          {/* Available Balance Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <button 
              onClick={() => setIsAvailableBalanceOpen(!isAvailableBalanceOpen)}
              className="p-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50 transition-colors rounded-t-xl"
            >
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                Available Balance {isAvailableBalanceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <div className={`px-2.5 py-0.5 rounded-[12px] text-sm font-bold ${categoryData.available >= 0 ? 'bg-[#98E85B] text-[#1A3104]' : 'bg-[#E54545] text-white'}`}>
                {formatCurrency(categoryData.available)}
              </div>
            </button>
            <AnimatePresence>
              {isAvailableBalanceOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 flex flex-col gap-2.5 text-[13px]">
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Cash Left Over From Last Month</span>
                      <span className="font-medium">{formatCurrency(0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Assigned This Month</span>
                      <span className="font-medium text-slate-700">+{formatCurrency(categoryData.assigned)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Cash Spending</span>
                      <span className="font-medium">{formatCurrency(categoryData.activity >= 0 ? 0 : categoryData.activity)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Credit Spending</span>
                      <span className="font-medium">{formatCurrency(0)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Target Section */}
          {isEditingTarget ? renderTargetEditor() : renderTargetDisplay()}

          {/* Auto-Assign Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col mt-2">
            <button 
              onClick={() => setIsAutoAssignOpen(!isAutoAssignOpen)}
              className="p-4 border-b border-slate-100 flex items-center gap-1.5 hover:bg-slate-50 transition-colors rounded-t-xl w-full text-left"
            >
              <Zap size={14} className="text-slate-800" />
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                Auto-Assign {isAutoAssignOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>
            
            <AnimatePresence>
              {isAutoAssignOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col p-2 text-sm">
                    <button 
                      onClick={() => onUpdateAssigned(categoryData.id, categoryData.assigned + (categoryData.assignedLastMonth || 0))}
                      className="flex justify-between items-center px-2 py-2 rounded hover:bg-slate-50 text-[#3B42A4] font-medium transition-colors"
                    >
                      <span>Assigned Last Month</span>
                      <span>{formatCurrency(categoryData.assignedLastMonth || 0)}</span>
                    </button>
                    <button 
                      onClick={() => onUpdateAssigned(categoryData.id, categoryData.assigned + (categoryData.spentLastMonth || 0))}
                      className="flex justify-between items-center px-2 py-2 rounded hover:bg-slate-50 text-[#3B42A4] font-medium transition-colors"
                    >
                      <span>Spent Last Month</span>
                      <span>{formatCurrency(categoryData.spentLastMonth || 0)}</span>
                    </button>
                    <button className="flex justify-between items-center px-2 py-2 rounded hover:bg-slate-50 text-[#3B42A4] font-medium transition-colors">
                      <span>Average Assigned</span>
                      <span>{formatCurrency(0)}</span>
                    </button>
                    <button className="flex justify-between items-center px-2 py-2 rounded hover:bg-slate-50 text-[#3B42A4] font-medium transition-colors">
                      <span>Average Spent</span>
                      <span>{formatCurrency(0)}</span>
                    </button>
                    
                    <div className="h-px bg-slate-100 my-2 mx-2"></div>
                    
                    <button className="flex justify-between items-center px-2 py-2 rounded hover:bg-slate-50 text-[#3B42A4] font-medium transition-colors">
                      <span>Reset Available Amount</span>
                      <span>{formatCurrency(0)}</span>
                    </button>
                    <button 
                      onClick={() => onUpdateAssigned(categoryData.id, 0)}
                      className="flex justify-between items-center px-2 py-2 rounded hover:bg-slate-50 text-[#3B42A4] font-medium transition-colors"
                    >
                      <span>Reset Assigned Amount</span>
                      <span>{formatCurrency(categoryData.assigned)}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mt-2 flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Notes</h3>
            <textarea 
              className="w-full h-24 text-sm text-slate-600 outline-none resize-none bg-transparent placeholder:text-slate-400"
              placeholder="Enter a note..."
            />
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  )
}
