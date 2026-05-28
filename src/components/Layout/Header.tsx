"use client"

import React, { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, StickyNote, Sparkles, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/currency"
import { motion, AnimatePresence } from "framer-motion"

interface HeaderProps {
  readyToAssign?: number
  month?: string
  // Breakdown data for the RTA popover
  totalInflows?: number
  totalAssigned?: number
  totalOverspending?: number
  // Auto-assign callbacks
  onAutoAssignUnderfunded?: () => void
  onAutoAssignLastMonth?: () => void
  onResetAssigned?: () => void
}

export default function Header({ 
  readyToAssign = 0, 
  month = "2026-05",
  totalInflows = 0,
  totalAssigned = 0,
  totalOverspending = 0,
  onAutoAssignUnderfunded,
  onAutoAssignLastMonth,
  onResetAssigned
}: HeaderProps) {
  const router = useRouter()
  const [showRTABreakdown, setShowRTABreakdown] = useState(false)
  const [showAutoAssign, setShowAutoAssign] = useState(false)
  const [showMonthNote, setShowMonthNote] = useState(false)
  const [monthNote, setMonthNote] = useState("")
  
  const rtaRef = useRef<HTMLDivElement>(null)
  const autoRef = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (rtaRef.current && !rtaRef.current.contains(e.target as Node)) setShowRTABreakdown(false)
      if (autoRef.current && !autoRef.current.contains(e.target as Node)) setShowAutoAssign(false)
      if (noteRef.current && !noteRef.current.contains(e.target as Node)) setShowMonthNote(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Parse "YYYY-MM" to readable month (e.g. "May 2026")
  const dateObj = new Date(month + "-01T00:00:00")
  const readableMonth = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handlePrevMonth = () => {
    const [y, m] = month.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 2, 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    router.push(`?month=${newMonth}`)
  }

  const handleNextMonth = () => {
    const [y, m] = month.split('-')
    const date = new Date(parseInt(y), parseInt(m), 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    router.push(`?month=${newMonth}`)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      if (e.key === 'ArrowLeft') {
        handlePrevMonth()
      } else if (e.key === 'ArrowRight') {
        handleNextMonth()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [month, router])

  const rtaPositive = readyToAssign >= 0

  return (
    <header className="h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
      
      {/* Left: Month Selector + Notes */}
      <div className="flex items-center gap-3">
        <button 
          onClick={handlePrevMonth} 
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all active:scale-95"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#005A87] w-[180px] text-center select-none tracking-tight">
          {readableMonth}
        </h1>
        <button 
          onClick={handleNextMonth} 
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all active:scale-95"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>

        {/* Month Notes Icon */}
        <div ref={noteRef} className="relative">
          <button 
            onClick={() => setShowMonthNote(!showMonthNote)}
            className={`p-1.5 rounded-full transition-all ${showMonthNote ? 'bg-[#005A87] text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            aria-label="Month notes"
          >
            <StickyNote size={16} />
          </button>
          <AnimatePresence>
            {showMonthNote && (
              <motion.div 
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Month Notes</span>
                  <button onClick={() => setShowMonthNote(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  value={monthNote}
                  onChange={(e) => setMonthNote(e.target.value)}
                  placeholder="Add a note for this month..."
                  className="w-full h-24 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#005A87]/20 focus:border-[#005A87]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center: Ready To Assign Pill (Clickable → Breakdown) */}
      <div ref={rtaRef} className="relative">
        <button
          onClick={() => setShowRTABreakdown(!showRTABreakdown)}
          className={`
            flex flex-col items-center justify-center px-8 py-2 rounded-full cursor-pointer
            transition-all active:scale-[0.98] hover:shadow-md
            ${rtaPositive 
              ? 'bg-[#23B573] text-white shadow-sm' 
              : 'bg-[#E54545] text-white shadow-sm'
            }
          `}
        >
          <div className="text-lg font-bold tracking-tight leading-tight">
            {formatCurrency(readyToAssign)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
            Ready to Assign
            <ChevronDown size={10} className={`transition-transform ${showRTABreakdown ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* RTA Breakdown Popover */}
        <AnimatePresence>
          {showRTABreakdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-5 z-50"
            >
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">How did we get here?</div>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Inflows</span>
                  <span className="font-semibold text-[#23B573]">+{formatCurrency(totalInflows)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Assigned</span>
                  <span className="font-semibold text-slate-700">-{formatCurrency(totalAssigned)}</span>
                </div>
                {totalOverspending > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Overspending</span>
                    <span className="font-semibold text-[#E54545]">-{formatCurrency(totalOverspending)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 mt-1 flex justify-between text-sm font-bold">
                  <span className="text-slate-800">Ready to Assign</span>
                  <span className={rtaPositive ? 'text-[#23B573]' : 'text-[#E54545]'}>
                    {formatCurrency(readyToAssign)}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Auto-Assign Dropdown */}
      <div ref={autoRef} className="relative">
        <button
          onClick={() => setShowAutoAssign(!showAutoAssign)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#005A87] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all active:scale-[0.98] shadow-sm"
        >
          <Sparkles size={14} />
          Auto-Assign
          <ChevronDown size={14} className={`transition-transform ${showAutoAssign ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showAutoAssign && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50"
            >
              <button
                onClick={() => { onAutoAssignUnderfunded?.(); setShowAutoAssign(false) }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-[#005A87] transition-colors"
              >
                <div className="font-semibold">Underfunded</div>
                <div className="text-xs text-slate-400 mt-0.5">Fill all categories up to their targets</div>
              </button>
              <button
                onClick={() => { onAutoAssignLastMonth?.(); setShowAutoAssign(false) }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-[#005A87] transition-colors"
              >
                <div className="font-semibold">Assigned Last Month</div>
                <div className="text-xs text-slate-400 mt-0.5">Match what you assigned last month</div>
              </button>
              <div className="border-t border-slate-100 mx-3 my-1"></div>
              <button
                onClick={() => { onResetAssigned?.(); setShowAutoAssign(false) }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-[#005A87] transition-colors"
              >
                <div className="font-semibold">Reset All Assigned</div>
                <div className="text-xs text-slate-400 mt-0.5">Set all categories to ₹0.00 this month</div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
