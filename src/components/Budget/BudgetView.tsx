"use client"

import React, { useState, useEffect } from "react"
import BudgetTable from "./BudgetTable"
import MoveMoneyModal from "./MoveMoneyModal"
import Inspector from "./Inspector"
import Header from "@/components/Layout/Header"
import { Filter, PlusCircle, Undo2, Redo2, History, List, AlignJustify } from "lucide-react"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [checkedCategoryIds, setCheckedCategoryIds] = useState<string[]>([])
  const [groups, setGroups] = useState<any[]>(initialData?.categoryGroups || [])

  const [isAddingCategoryGroup, setIsAddingCategoryGroup] = useState(false)
  const [newCategoryGroupName, setNewCategoryGroupName] = useState("")
  const [showProgressBars, setShowProgressBars] = useState(false)

  const [past, setPast] = useState<{ categoryId: string, amount: number }[]>([])
  const [future, setFuture] = useState<{ categoryId: string, amount: number }[]>([])

  const [isMoveMoneyOpen, setIsMoveMoneyOpen] = useState(false)
  const [moveMoneyInitialFrom, setMoveMoneyInitialFrom] = useState<string | undefined>(undefined)

  useEffect(() => {
    setGroups(initialData?.categoryGroups || [])
  }, [initialData])

  const visibleRows = React.useMemo(() => {
    const rows: string[] = []
    groups.forEach((g: any) => {
      rows.push(g.id)
      if (g.isExpanded) {
        g.categories.forEach((c: any) => rows.push(c.id))
      }
    })
    return rows
  }, [groups])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (!e.target.classList.contains('assigned-input')) {
          return
        }
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (!selectedCategoryId) {
          setSelectedCategoryId(visibleRows[0])
          return
        }

        const currentIndex = visibleRows.indexOf(selectedCategoryId)
        if (currentIndex === -1) return

        if (e.key === 'ArrowUp' && currentIndex > 0) {
          setSelectedCategoryId(visibleRows[currentIndex - 1])
        } else if (e.key === 'ArrowDown' && currentIndex < visibleRows.length - 1) {
          setSelectedCategoryId(visibleRows[currentIndex + 1])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCategoryId, visibleRows])

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

  const handleUpdateTarget = async (categoryId: string, targetType: string, target: number, targetCadence?: string | null, targetDate?: Date | null, targetRepeatEvery?: number | null, targetRepeatCadence?: string | null) => {
    // Optimistic Update
    setGroups((prevGroups: any[]) => prevGroups.map((g: any) => ({
      ...g,
      categories: g.categories.map((c: any) =>
        c.id === categoryId
          ? { ...c, targetType, target, targetCadence, targetDate, targetRepeatEvery, targetRepeatCadence }
          : c
      )
    })))

    // Server Update
    await updateCategoryTarget(categoryId, targetType, target, targetCadence, targetDate, targetRepeatEvery, targetRepeatCadence)
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
  }).filter((g: any) => activeFilter === 'all' || g.categories.length > 0)

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

  const handleAddCategoryGroup = async () => {
    if (newCategoryGroupName.trim()) {
      const name = newCategoryGroupName.trim()
      setIsAddingCategoryGroup(false)
      setNewCategoryGroupName("")

      const { createCategoryGroup } = await import("@/app/actions/budget")
      const budgetId = initialData?.id
      if (budgetId) {
        const savedGroup = await createCategoryGroup(budgetId, name)
        setGroups(prev => [...prev, { ...savedGroup, categories: [], isExpanded: true }])
        router.refresh()
      }
    }
  }

  const handleCheckCategory = (categoryId: string) => {
    setCheckedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handleCheckGroup = (groupId: string) => {
    const group = groups.find((g: any) => g.id === groupId)
    if (!group) return
    const groupCatIds = group.categories.map((c: any) => c.id)

    const allChecked = groupCatIds.every((id: string) => checkedCategoryIds.includes(id))

    if (allChecked) {
      setCheckedCategoryIds(prev => prev.filter(id => !groupCatIds.includes(id)))
    } else {
      setCheckedCategoryIds(prev => {
        const newIds = new Set(prev)
        groupCatIds.forEach((id: string) => newIds.add(id))
        return Array.from(newIds)
      })
    }
  }

  const handleCheckAll = () => {
    const allCatIds = groups.flatMap((g: any) => g.categories.map((c: any) => c.id))
    const allChecked = allCatIds.length > 0 && allCatIds.every((id: string) => checkedCategoryIds.includes(id))

    if (allChecked) {
      setCheckedCategoryIds([])
    } else {
      setCheckedCategoryIds(allCatIds)
    }
  }

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
          {/* Filters Row */}
          <div className="bg-white px-6 pt-3 pb-0 flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-lg border transition-colors ${activeFilter === 'all' ? 'bg-[#EEF2FC] border-[#5155C3]/30 text-[#5155C3]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('underfunded')}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-lg border transition-colors ${activeFilter === 'underfunded' ? 'bg-orange-50 border-orange-200 text-[#E8A317]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            >
              Underfunded
            </button>
            <button
              onClick={() => setActiveFilter('overspent')}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-lg border transition-colors ${activeFilter === 'overspent' ? 'bg-red-50 border-red-200 text-[#E54545]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            >
              Overfunded
            </button>
            <button
              onClick={() => setActiveFilter('available')}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-lg border transition-colors ${activeFilter === 'available' ? 'bg-green-50 border-green-200 text-[#23B573]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            >
              Money Available
          </div>

          {/* Toolbar Row */}
          <div className="flex justify-between items-center px-6 py-2 border-b border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-10">
            <div className="flex gap-4 items-center">
              <div className="relative">
                <button
                  onClick={() => setIsAddingCategoryGroup(true)}
                  className="text-[14px] font-bold text-[#5155C3] hover:text-[#3B42A4] transition-colors flex items-center gap-1.5"
                >
                  <PlusCircle size={16} className="fill-[#5155C3] text-white" /> Category Group
                </button>

                {isAddingCategoryGroup && (
                  <div className="absolute top-full left-0 mt-3 w-[280px] bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-100 p-4 z-50">
                    <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-t border-l border-slate-100 rotate-45"></div>
                    <input
                      autoFocus
                      type="text"
                      value={newCategoryGroupName}
                      onChange={(e) => setNewCategoryGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategoryGroup()
                        if (e.key === 'Escape') {
                          setIsAddingCategoryGroup(false)
                          setNewCategoryGroupName("")
                        }
                      }}
                      placeholder="New Category Group"
                      className="w-full px-3 py-2 text-[15px] border border-[#5155C3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#5155C3]/20 relative z-10"
                    />
                    <div className="flex justify-end gap-2 mt-4 relative z-10">
                      <button
                        onClick={() => {
                          setIsAddingCategoryGroup(false)
                          setNewCategoryGroupName("")
                        }}
                        className="px-5 py-1.5 text-[14px] font-bold text-[#5155C3] bg-[#F0F2FF] rounded-lg hover:bg-[#E5E7FF] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddCategoryGroup}
                        className="px-5 py-1.5 text-[14px] font-bold text-white bg-[#5155C3] rounded-lg hover:bg-[#3B42A4] transition-colors"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleUndo}
                disabled={past.length === 0}
                className={`text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${past.length === 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#5155C3] hover:text-[#3B42A4]'}`}
              >
                <Undo2 size={15} /> Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={future.length === 0}
                className={`text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${future.length === 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#5155C3] hover:text-[#3B42A4]'}`}
              >
                <Redo2 size={15} /> Redo
              </button>
            </div>

            <div className="relative group flex items-center gap-3">
              <div className="flex items-center bg-[#F4F4F4] rounded-md p-0.5 border border-slate-200">
                <button className="px-2 py-1 rounded bg-white shadow-sm text-slate-700">
                  <AlignJustify size={14} />
                </button>
                <button className="px-2 py-1 rounded text-slate-400 hover:text-slate-600 transition-colors">
                  <List size={14} />
                </button>
              </div>
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
            onMoveMoney={handleMoveMoney}
            showProgressBars={showProgressBars}
            checkedCategoryIds={checkedCategoryIds}
            onCheckCategory={handleCheckCategory}
            onCheckGroup={handleCheckGroup}
            onCheckAll={handleCheckAll}
            month={month}
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
            month={month}
          />
        </div>
      </div>
    </div>
  )
}
