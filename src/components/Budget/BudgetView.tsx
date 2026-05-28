"use client"

import React, { useState, useEffect } from "react"
import BudgetTable from "./BudgetTable"
import MoveMoneyModal from "./MoveMoneyModal"
import Inspector from "./Inspector"
import Header from "@/components/Layout/Header"
import { updateCategoryAssigned, updateCategoryTarget, moveMoney } from "@/app/actions/budget"

interface BudgetViewProps {
  initialData: any
  month: string
  readyToAssign?: number
  totalInflows?: number
  totalAssigned?: number
  totalOverspending?: number
}

export default function BudgetView({ 
  initialData, 
  month, 
  readyToAssign = 0,
  totalInflows = 0,
  totalAssigned = 0,
  totalOverspending = 0
}: BudgetViewProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [groups, setGroups] = useState(initialData?.categoryGroups || [])
  
  const [past, setPast] = useState<{ categoryId: string, amount: number }[]>([])
  const [future, setFuture] = useState<{ categoryId: string, amount: number }[]>([])

  const [isMoveMoneyOpen, setIsMoveMoneyOpen] = useState(false)
  const [moveMoneyInitialFrom, setMoveMoneyInitialFrom] = useState<string | undefined>(undefined)

  useEffect(() => {
    setGroups(initialData?.categoryGroups || [])
  }, [initialData])

  const performUpdate = async (categoryId: string, newAssignedCents: number) => {
    // Optimistic Update
    setGroups((prevGroups: any[]) => prevGroups.map((g: any) => ({
      ...g,
      categories: g.categories.map((c: any) => 
        c.id === categoryId 
          ? { ...c, assigned: newAssignedCents, available: (c.available - c.assigned) + newAssignedCents } 
          : c
      )
    })))
    
    // Server Update
    await updateCategoryAssigned(categoryId, month, newAssignedCents)
  }

  const handleUpdateAssigned = async (categoryId: string, newAssignedCents: number) => {
    const oldCategory = groups.flatMap((g: any) => g.categories).find((c: any) => c.id === categoryId)
    if (oldCategory) {
      setPast([...past, { categoryId, amount: oldCategory.assigned }])
      setFuture([])
    }
    await performUpdate(categoryId, newAssignedCents)
  }

  const handleMoveMoney = async (amountCents: number, fromId: string, toId: string) => {
    // Optimistic UI updates
    setGroups((prevGroups: any[]) => prevGroups.map((g: any) => ({
      ...g,
      categories: g.categories.map((c: any) => {
        if (c.id === fromId) {
          return { ...c, assigned: c.assigned - amountCents, available: c.available - amountCents }
        }
        if (c.id === toId) {
          return { ...c, assigned: c.assigned + amountCents, available: c.available + amountCents }
        }
        return c
      })
    })))
    
    // Server Update
    await moveMoney(month, fromId, toId, amountCents)
  }

  const handleUndo = () => {
    if (past.length === 0) return
    const lastAction = past[past.length - 1]
    const currentCategory = groups.flatMap((g: any) => g.categories).find((c: any) => c.id === lastAction.categoryId)
    
    if (currentCategory) {
      setFuture([...future, { categoryId: currentCategory.id, amount: currentCategory.assigned }])
      setPast(past.slice(0, -1))
      performUpdate(lastAction.categoryId, lastAction.amount)
    }
  }

  const handleRedo = () => {
    if (future.length === 0) return
    const nextAction = future[future.length - 1]
    const currentCategory = groups.flatMap((g: any) => g.categories).find((c: any) => c.id === nextAction.categoryId)
    
    if (currentCategory) {
      setPast([...past, { categoryId: currentCategory.id, amount: currentCategory.assigned }])
      setFuture(future.slice(0, -1))
      performUpdate(nextAction.categoryId, nextAction.amount)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault()
        setGroups((prev: any[]) => prev.map(g => ({ ...g, isExpanded: false })))
        return
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault()
        setGroups((prev: any[]) => prev.map(g => ({ ...g, isExpanded: true })))
        return
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [past, future])

  const handleUpdateTarget = async (categoryId: string, targetType: string, target: number) => {
    // Optimistic Update
    setGroups((prevGroups: any[]) => prevGroups.map((g: any) => ({
      ...g,
      categories: g.categories.map((c: any) => 
        c.id === categoryId 
          ? { ...c, targetType, target } 
          : c
      )
    })))

    // Server Update
    await updateCategoryTarget(categoryId, targetType, target)
  }

  const handleAutoAssignUnderfunded = () => {
    groups.forEach((g: any) => {
      g.categories.forEach((c: any) => {
        const under = Math.max(0, (c.target || 0) - c.available)
        if (under > 0) {
          handleUpdateAssigned(c.id, c.assigned + under)
        }
      })
    })
  }

  const handleAutoAssignLastMonth = () => {
    groups.forEach((g: any) => {
      g.categories.forEach((c: any) => {
        if (c.assignedLastMonth && c.assignedLastMonth > 0) {
          handleUpdateAssigned(c.id, c.assigned + c.assignedLastMonth)
        }
      })
    })
  }

  const handleResetAssigned = () => {
    groups.forEach((g: any) => {
      g.categories.forEach((c: any) => {
        if (c.assigned > 0) {
          handleUpdateAssigned(c.id, 0)
        }
      })
    })
  }

  const [activeFilter, setActiveFilter] = useState<'all' | 'underfunded' | 'overspent' | 'available'>('all')

  const filteredGroups = groups.map((g: any) => {
    let filteredCategories = g.categories
    if (activeFilter === 'underfunded') {
      filteredCategories = g.categories.filter((c: any) => c.target > 0 && c.available < c.target)
    } else if (activeFilter === 'overspent') {
      filteredCategories = g.categories.filter((c: any) => c.available < 0)
    } else if (activeFilter === 'available') {
      filteredCategories = g.categories.filter((c: any) => c.available > 0)
    }
    return { ...g, categories: filteredCategories }
  }).filter((g: any) => g.categories.length > 0)

  // Find selected category data
  let selectedCategoryData = null
  for (const g of groups) {
    for (const c of g.categories) {
      if (c.id === selectedCategoryId) {
        selectedCategoryData = c
      }
    }
  }

  const allCategories = groups.flatMap((g: any) => g.categories)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header 
        readyToAssign={readyToAssign}
        month={month}
        totalInflows={totalInflows}
        totalAssigned={totalAssigned}
        totalOverspending={totalOverspending}
        onAutoAssignUnderfunded={handleAutoAssignUnderfunded}
        onAutoAssignLastMonth={handleAutoAssignLastMonth}
        onResetAssigned={handleResetAssigned}
      />
      <div className="flex flex-1 overflow-hidden bg-slate-50">
        {isMoveMoneyOpen && (
        <MoveMoneyModal
          onClose={() => setIsMoveMoneyOpen(false)}
          onMove={handleMoveMoney}
          categories={allCategories}
          initialFromId={moveMoneyInitialFrom}
        />
      )}
      <div className="flex flex-col flex-1 border-r border-slate-200 overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-3 border-b border-slate-200 bg-white">
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                const name = window.prompt("Enter new category group name:")
                if (name) {
                  const { createCategoryGroup } = await import("@/app/actions/budget")
                  const budgetId = initialData?.id
                  if (budgetId) {
                    await createCategoryGroup(budgetId, name)
                  }
                }
              }}
              className="px-3 py-1.5 text-sm font-medium text-[#005A87] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors shadow-sm"
            >
              + Category Group
            </button>
            <div className="border-l border-slate-200 mx-2"></div>
            <button 
              onClick={handleUndo}
              disabled={past.length === 0}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              Undo
            </button>
            <button 
              onClick={handleRedo}
              disabled={future.length === 0}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              Redo
            </button>
            <button 
              onClick={() => { setMoveMoneyInitialFrom(undefined); setIsMoveMoneyOpen(true); }}
              className="px-3 py-1.5 text-sm font-medium text-white bg-[#005A87] rounded-md hover:bg-[#004566] transition-colors shadow-sm"
            >
              Move Money
            </button>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${activeFilter === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All
            </button>
            <button 
              onClick={() => setActiveFilter('underfunded')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${activeFilter === 'underfunded' ? 'bg-white shadow text-[#E8A317]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Underfunded
            </button>
            <button 
              onClick={() => setActiveFilter('overspent')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${activeFilter === 'overspent' ? 'bg-white shadow text-[#E54545]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Overspent
            </button>
            <button 
              onClick={() => setActiveFilter('available')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${activeFilter === 'available' ? 'bg-white shadow text-[#23B573]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Money Available
            </button>
          </div>
        </div>
        
        {readyToAssign < 0 && (
          <div className="bg-[#E54545]/10 border-b border-[#E54545]/20 px-6 py-2.5 flex items-center justify-between shadow-inner">
            <span className="text-sm font-medium text-[#E54545] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#E54545] text-white flex items-center justify-center text-xs font-bold">!</span>
              You've assigned more than you have. Cover the overspending from another category.
            </span>
            <button 
              onClick={() => { setMoveMoneyInitialFrom("RTA"); setIsMoveMoneyOpen(true); }}
              className="px-3 py-1 text-xs font-semibold text-white bg-[#E54545] rounded hover:bg-[#CC3B3B] transition-colors"
            >
              Fix This
            </button>
          </div>
        )}

        <BudgetTable 
          groups={filteredGroups}
          setGroups={setGroups}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          onUpdateAssigned={handleUpdateAssigned}
          onAvailableClick={(categoryId) => {
            setMoveMoneyInitialFrom(categoryId)
            setIsMoveMoneyOpen(true)
          }}
        />
      </div>
      
      <div className="w-[320px] bg-slate-50 overflow-y-auto shrink-0 border-l border-slate-200">
        <Inspector 
          categoryData={selectedCategoryData}
          onUpdateAssigned={handleUpdateAssigned}
          onUpdateTarget={handleUpdateTarget}
          groups={groups}
        />
        </div>
      </div>
    </div>
  )
}
