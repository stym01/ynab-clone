"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"

interface KeyboardShortcutsModalProps {
  onClose: () => void
}

const ShortcutSection = ({ title, items, className = "" }: { title: string, items: any[], className?: string }) => (
  <div className={`flex flex-col gap-3 mb-8 ${className}`}>
    <h3 className="font-bold text-slate-800 text-base">{title}</h3>
    <div className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
          <span className="text-sm text-slate-700">{item.label}</span>
          <div className="flex items-center gap-1.5">
            {item.preText && <span className="text-sm text-slate-500 mr-1">{item.preText}</span>}
            {item.keys.map((k: string, i: number) => (
              <kbd key={i} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-semibold text-slate-700 min-w-[24px] text-center shadow-sm">
                {k}
              </kbd>
            ))}
            {item.postText && <span className="text-sm text-slate-500 mx-1">{item.postText}</span>}
            {item.additionalKeys?.map((k: string, i: number) => (
              <kbd key={`add-${i}`} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-semibold text-slate-700 min-w-[24px] text-center shadow-sm">
                {k}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800">Keyboard Shortcuts</h2>
          <button 
            onClick={onClose}
            className="p-2 text-[#005A87] hover:bg-blue-50 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            
            {/* Left Column */}
            <div>
              <ShortcutSection 
                title="Universal"
                items={[
                  { label: "Open Keyboard Shortcuts Help", keys: ["?"] },
                  { label: "Expand/Collapse Sidebar", keys: ["shift", "."] },
                  { label: "Select All", keys: ["ctrl", "A"] },
                  { label: "Deselect All", keys: ["escape"] },
                ]}
              />

              <ShortcutSection 
                title="Plan Actions"
                items={[
                  { label: "Snooze target", keys: ["shift", "Z"] },
                  { label: "Collapse/expand groups", keys: ["ctrl", "↑/↓"] },
                  { label: "Move between plan rows", keys: ["↑/↓"] },
                  { label: "Select multiple categories", keys: ["shift", "↑/↓"] },
                ]}
              />

              <ShortcutSection 
                title="Account Actions"
                items={[
                  { label: "Add new transaction", keys: ["shift", "N"] },
                  { label: "Approve", keys: ["A"] },
                  { label: "Approve all transactions", keys: ["shift", "L"] },
                  { label: "Reject", keys: ["shift", "R"] },
                  { label: "Categorize", keys: ["K"] },
                  { label: "Split", keys: ["S"] },
                  { label: "Enter Now", keys: ["E"] },
                  { label: "Match", keys: ["M"] },
                  { label: "Unmatch", keys: ["shift", "U"] },
                  { label: "Toggle cleared state", keys: ["C"] },
                  { label: "Duplicate", keys: ["shift", "D"] },
                ]}
              />
            </div>

            {/* Right Column */}
            <div>
              <ShortcutSection 
                title=""
                className="-mt-11" // Offset to align with Universal list
                items={[
                  { label: "Math operations", keys: ["+", "-", "x", "/"] },
                  { label: "Undo", keys: ["ctrl", "Z"] },
                  { label: "Redo", keys: ["ctrl", "shift", "Z"] },
                ]}
              />

              <ShortcutSection 
                title=""
                className="mt-[116px]" // Offset to align with Plan Actions list
                items={[
                  { label: "Flag", keys: ["shift", "F"], postText: "then", additionalKeys: ["0-6"] },
                  { label: "Make repeating", keys: ["shift", "T"] },
                  { label: "Delete", keys: ["delete"] },
                  { label: "Reconcile", keys: ["shift", "E"] },
                  { label: "Focus on the search bar", keys: ["ctrl", "shift", "F"] },
                  { label: "Select a group of transactions", keys: ["shift", "click"] },
                  { label: "Select multiple transactions", keys: ["shift", "↑/↓"] },
                  { label: "Move between transactions", keys: ["↑/↓"] },
                  { label: "Move to next transaction field", keys: ["tab"] },
                  { label: "Move to previous transaction field", keys: ["shift", "tab"] },
                ]}
              />

              <div className="mt-8"></div>

              <ShortcutSection 
                title="Date Picker"
                items={[
                  { label: "Navigate the date picker", keys: ["↑", "↓", "←", "→"] },
                  { label: "Move date one day forward", keys: ["+"] },
                  { label: "Move date one day backward", keys: ["-"] },
                  { label: "Select today", keys: ["T"] },
                  { label: "Select first day of month", keys: ["M"] },
                  { label: "Select last day of month", keys: ["shift", "M"] },
                  { label: "Select first day of year", keys: ["Y"] },
                  { label: "Select last day of year", keys: ["shift", "Y"] },
                ]}
              />
            </div>
            
          </div>
        </div>
      </motion.div>
    </div>
  )
}
