"use client"

import React, { useState, useEffect } from "react"
import Sidebar from "./Sidebar"
import KeyboardShortcutsModal from "./KeyboardShortcutsModal"
import { AnimatePresence } from "framer-motion"

export default function AppLayout({ children, accounts = [], budgets = [], activeBudget = null }: { children: React.ReactNode, accounts?: any[], budgets?: any[], activeBudget?: any }) {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [forceSidebarCollapsed, setForceSidebarCollapsed] = useState<boolean | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === '?') {
        setShowShortcutsModal(true)
      } else if ((e.key === '.' || e.key === '>') && e.shiftKey) {
        setForceSidebarCollapsed(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar accounts={accounts} budgets={budgets} activeBudget={activeBudget} externalCollapsed={forceSidebarCollapsed} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
      <AnimatePresence>
        {showShortcutsModal && (
          <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
