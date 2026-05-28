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
  const monthDropdownRef = useRef<HTMLDivElement>(null)

  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [dropdownYear, setDropdownYear] = useState<number>(parseInt(month.split('-')[0]) || new Date().getFullYear())

  useEffect(() => {
    setDropdownYear(parseInt(month.split('-')[0]))
  }, [month])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (rtaRef.current && !rtaRef.current.contains(e.target as Node)) setShowRTABreakdown(false)
      if (autoRef.current && !autoRef.current.contains(e.target as Node)) setShowAutoAssign(false)
      if (noteRef.current && !noteRef.current.contains(e.target as Node)) setShowMonthNote(false)
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node)) setShowMonthDropdown(false)
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
    <header className="h-[90px] bg-white border-b border-slate-200 flex items-center px-6 flex-shrink-0 shadow-sm relative z-20">
      
      {/* Left: Month Selector + Notes */}
      <div className="flex items-center gap-4 relative flex-1" ref={monthDropdownRef}>
        <button 
          onClick={handlePrevMonth} 
          className="p-1 rounded-full text-[#5155C3] border-[2px] border-[#5155C3] hover:bg-slate-50 transition-all active:scale-95"
          aria-label="Previous month"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        
        <div 
          className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowMonthDropdown(!showMonthDropdown)}
        >
          <div className="flex items-center gap-1">
            <h1 className="text-[26px] font-bold text-slate-800 text-center select-none tracking-tight">
              {readableMonth}
            </h1>
            <ChevronDown size={16} strokeWidth={3} className="text-[#5155C3] mt-1" />
          </div>
          <span className="text-[13px] text-slate-500 font-medium pl-1">Enter a note...</span>
        </div>

        <button 
          onClick={handleNextMonth} 
          className="p-1 rounded-full text-[#5155C3] border-[2px] border-[#5155C3] hover:bg-slate-50 transition-all active:scale-95"
          aria-label="Next month"
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>

        {/* Month Dropdown Popover */}
        <AnimatePresence>
          {showMonthDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              className="absolute top-full left-4 mt-2 w-64 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-100 p-4 z-50 origin-top-left"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <button 
                  onClick={() => setDropdownYear(y => y - 1)}
                  className="p-0.5 rounded-full text-[#5155C3] border-2 border-[#5155C3] hover:bg-slate-50 transition-all active:scale-95"
                >
                  <ChevronLeft size={16} strokeWidth={2.5} />
                </button>
                <span className="font-bold text-[17px] text-slate-800">{dropdownYear}</span>
                <button 
                  onClick={() => setDropdownYear(y => y + 1)}
                  className="p-0.5 rounded-full text-[#5155C3] border-2 border-[#5155C3] hover:bg-slate-50 transition-all active:scale-95"
                >
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, index) => {
                  const mStr = String(index + 1).padStart(2, '0')
                  const isCurrent = `${dropdownYear}-${mStr}` === month
                  
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        const newMonth = `${dropdownYear}-${mStr}`
                        router.push(`?month=${newMonth}`)
                        setShowMonthDropdown(false)
                      }}
                      className={`text-[15px] font-bold py-2 px-1 rounded-md transition-all ${
                        isCurrent 
                          ? 'bg-[#5155C3] text-white shadow-sm' 
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Center: Ready To Assign Pill (Clickable → Breakdown) */}
      <div ref={rtaRef} className="relative flex justify-center flex-1">
        <div className={`
          flex items-center justify-between pl-5 pr-2 py-2 rounded-[14px]
          transition-all min-w-[280px] h-[65px]
          ${rtaPositive 
            ? 'bg-[#BAF45A] shadow-sm' 
            : 'bg-[#E54545] shadow-sm'
          }
        `}>
          <div className="flex flex-col items-start pr-12 cursor-pointer" onClick={() => setShowRTABreakdown(!showRTABreakdown)}>
            <div className={`text-[22px] font-bold tracking-tight leading-none mb-1 ${rtaPositive ? 'text-[#1A3104]' : 'text-white'}`}>
              {formatCurrency(readyToAssign)}
            </div>
            <div className={`text-[13px] font-semibold opacity-90 ${rtaPositive ? 'text-[#1A3104]' : 'text-white'}`}>
              Ready to Assign
            </div>
          </div>
          <div ref={autoRef} className="relative h-full flex items-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowAutoAssign(!showAutoAssign); }}
              className={`
                flex items-center justify-center gap-2 px-5 h-[42px] rounded-[10px] font-bold text-[15px] transition-colors shadow-sm
                ${rtaPositive ? 'bg-[#508B1C] hover:bg-[#3D6B15] text-white' : 'bg-red-700 hover:bg-red-800 text-white'}
              `}
            >
              Assign <ChevronDown size={14} className={`transition-transform ml-1 ${showAutoAssign ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showAutoAssign && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onAutoAssignUnderfunded?.(); setShowAutoAssign(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-[#005A87] transition-colors"
                  >
                    <div className="font-semibold flex items-center gap-2"><Sparkles size={14} /> Underfunded</div>
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
        </div>

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
      {/* Right spacer */}
      <div className="flex-1"></div>
    </header>
  )
}
