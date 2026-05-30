"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronDown, Zap, Plus, MoreHorizontal, Check, Minus } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/currency"
import { addCategory, renameCategory, deleteCategory, renameCategoryGroup, deleteCategoryGroup, getCategoryTransactions } from "@/app/actions/budget"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface BudgetTableProps {
  groups: any[]
  setGroups: React.Dispatch<React.SetStateAction<any[]>>
  selectedCategoryId: string | null
  onSelectCategory: (id: string) => void
  onUpdateAssigned: (categoryId: string, amount: number) => Promise<void>
  onAvailableClick?: (categoryId: string) => void
  onMoveMoney?: (amountCents: number, fromId: string, toId: string) => Promise<void>
  showProgressBars?: boolean
  checkedCategoryIds?: string[]
  onCheckCategory?: (categoryId: string) => void
  onCheckGroup?: (groupId: string) => void
  onCheckAll?: () => void
  month?: string
}

const SortableGroupRow = ({ id, className, onClick, onContextMenu, children, isSelected }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
    position: isDragging ? 'relative' : undefined,
    backgroundColor: isDragging ? '#EEF2FC' : undefined,
    cursor: 'grab',
  };
  return (
    <tr ref={setNodeRef} style={style} className={className} onClick={onClick} onContextMenu={onContextMenu} {...listeners} {...attributes}>
      {children()}
    </tr>
  );
};

const SortableCategoryRow = ({ id, className, onClick, onContextMenu, children, isSelected }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
    position: isDragging ? 'relative' : undefined,
    backgroundColor: isDragging ? '#EEF2FC' : undefined,
    cursor: 'grab',
  };
  return (
    <motion.tr 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.12 }}
      ref={setNodeRef} style={style} className={className} onClick={onClick} onContextMenu={onContextMenu} {...listeners} {...attributes}>
      {children()}
    </motion.tr>
  );
};

export default function BudgetTable({ 
  groups, setGroups, selectedCategoryId, onSelectCategory, onUpdateAssigned, onAvailableClick, onMoveMoney, showProgressBars,
  checkedCategoryIds, onCheckCategory, onCheckGroup, onCheckAll, month
}: BudgetTableProps) {
  const router = useRouter()
  
  const [editValue, setEditValue] = useState<string>("")
  const [coverOverspendingId, setCoverOverspendingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ type: 'category' | 'group', id: string, x: number, y: number } | null>(null)
  const [addingCategoryGroupId, setAddingCategoryGroupId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")

  const [inlineEditing, setInlineEditing] = useState<{ id: string, type: 'category' | 'group', name: string } | null>(null)

  const [activityPopoverId, setActivityPopoverId] = useState<string | null>(null)
  const [activityTransactions, setActivityTransactions] = useState<any[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)

  const handleActivityClick = async (e: React.MouseEvent, categoryId: string) => {
    e.stopPropagation()
    if (activityPopoverId === categoryId) {
      setActivityPopoverId(null)
      return
    }
    setActivityPopoverId(categoryId)
    setActivityTransactions([])
    setIsLoadingActivity(true)
    if (month) {
      const txs = await getCategoryTransactions(categoryId, month)
      setActivityTransactions(txs)
    }
    setIsLoadingActivity(false)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Check if dragging group
    const isGroupDrag = groups.some(g => g.id === active.id);
    if (isGroupDrag) {
      const oldIndex = groups.findIndex(g => g.id === active.id);
      const newIndex = groups.findIndex(g => g.id === over.id);
      if (newIndex === -1) return; // Dropped on a category instead of group

      const newGroups = arrayMove(groups, oldIndex, newIndex);
      setGroups(newGroups);

      const budgetId = groups[0]?.budgetId;
      if (budgetId) {
        const { reorderCategoryGroups } = await import("@/app/actions/budget");
        await reorderCategoryGroups(budgetId, newGroups.map(g => g.id));
      }
    } else {
      // It's a category drag
      let groupId = null;
      let oldIndex = -1;
      let newIndex = -1;
      for (const g of groups) {
        const catIdx = g.categories.findIndex((c: any) => c.id === active.id);
        if (catIdx !== -1) {
          groupId = g.id;
          oldIndex = catIdx;
          newIndex = g.categories.findIndex((c: any) => c.id === over.id);
          break;
        }
      }

      if (groupId && newIndex !== -1) {
        // Optimistic update
        setGroups(prev => prev.map(g => {
          if (g.id === groupId) {
            return { ...g, categories: arrayMove(g.categories, oldIndex, newIndex) };
          }
          return g;
        }));

        // Server update
        const { reorderCategories } = await import("@/app/actions/budget");
        const group = groups.find(g => g.id === groupId);
        if (group) {
          const newCategories = arrayMove(group.categories, oldIndex, newIndex);
          await reorderCategories(groupId, newCategories.map((c: any) => c.id));
        }
      }
    }
  };

  const toggleGroup = (groupId: string) => {
    setGroups(groups.map((g: any) => g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g))
  }

  const prevSelectedCategoryId = React.useRef(selectedCategoryId)
  const assignedInputRef = React.useRef<HTMLInputElement>(null)
  
  React.useEffect(() => {
    if (selectedCategoryId !== prevSelectedCategoryId.current) {
      prevSelectedCategoryId.current = selectedCategoryId
      if (selectedCategoryId) {
        let foundCategory = null
        for (const g of groups) {
          const cat = g.categories.find((c: any) => c.id === selectedCategoryId)
          if (cat) { foundCategory = cat; break; }
        }
        if (foundCategory) {
          setEditValue((foundCategory.assigned / 100).toFixed(2))
          setTimeout(() => {
            assignedInputRef.current?.select()
          }, 0)
        }
      }
    }
  }, [selectedCategoryId, groups])

  const handleEditSubmit = async (categoryId: string) => {
    let finalValue = editValue
    
    // Evaluate math expression
    try {
      const cleanExpr = editValue.replace(/[^\d.+\-*/()]/g, '')
      if (cleanExpr) {
        // eslint-disable-next-line no-eval
        const result = new Function('return ' + cleanExpr)()
        if (typeof result === 'number' && !isNaN(result)) {
          finalValue = result.toString()
        }
      }
    } catch (e) {
      // Ignore evaluation errors
    }

    const newAssignedCents = Math.round(parseFloat(finalValue || "0") * 100)
    if (categoryId === selectedCategoryId) {
      setEditValue((newAssignedCents / 100).toFixed(2))
    }
    await onUpdateAssigned(categoryId, newAssignedCents)
  }

  const handleKeyDown = (e: React.KeyboardEvent, categoryId: string) => {
    if (e.key === "Enter") {
      handleEditSubmit(categoryId)
    } else if (e.key === "Escape") {
      let foundCategory = null
      for (const g of groups) {
        const cat = g.categories.find((c: any) => c.id === selectedCategoryId)
        if (cat) { foundCategory = cat; break; }
      }
      if (foundCategory) {
        setEditValue((foundCategory.assigned / 100).toFixed(2))
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, type: 'category' | 'group', id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type, id, x: e.clientX, y: e.clientY })
  }

  const handleAddCategory = async (groupId: string) => {
    if (!newCategoryName.trim()) return
    const name = newCategoryName.trim()
    setNewCategoryName("")
    setAddingCategoryGroupId(null)
    
    const tempId = `temp-${Date.now()}`
    const newCat = {
      id: tempId,
      groupId,
      name,
      assigned: 0,
      activity: 0,
      available: 0,
      target: 0,
      targetType: null,
      isHidden: false,
      sortOrder: 999
    }
    
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, categories: [...g.categories, newCat] }
      }
      return g
    }))
    
    try {
      const savedCategory = await addCategory(groupId, name)
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            categories: g.categories.map((c: any) => c.id === tempId ? { ...savedCategory, assigned: 0, activity: 0, available: 0 } : c)
          }
        }
        return g
      }))
      router.refresh()
    } catch (error) {
      console.error("Failed to add category:", error)
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return { ...g, categories: g.categories.filter((c: any) => c.id !== tempId) }
        }
        return g
      }))
    }
  }

  const handleInlineEditSubmit = async () => {
    if (!inlineEditing || !inlineEditing.name.trim()) return
    
    if (inlineEditing.type === 'category') {
      await renameCategory(inlineEditing.id, inlineEditing.name.trim())
    } else {
      await renameCategoryGroup(inlineEditing.id, inlineEditing.name.trim())
    }
    
    setInlineEditing(null)
  }

  const handleRenameCategory = async (id: string) => {
    setContextMenu(null)
    const cat = groups.flatMap(g => g.categories).find(c => c.id === id)
    if (cat) setInlineEditing({ id, type: 'category', name: cat.name })
  }

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm("Delete this category? Transactions will be uncategorized.")) {
      await deleteCategory(id)
    }
    setContextMenu(null)
  }

  const handleRenameGroup = async (id: string) => {
    setContextMenu(null)
    const group = groups.find(g => g.id === id)
    if (group) setInlineEditing({ id, type: 'group', name: group.name })
  }

  const handleDeleteGroup = async (id: string) => {
    if (window.confirm("Delete this category group and all its categories?")) {
      await deleteCategoryGroup(id)
    }
    setContextMenu(null)
  }

  if (!groups || groups.length === 0) {
    return <div className="p-8 text-slate-500">No groups found.</div>
  }

  const getAvailableColor = (category: any) => {
    if (category.available > 0 && category.target > 0 && category.available < category.target) {
      return 'bg-[#E8A317] text-white'
    } else if (category.available > 0) {
      return 'bg-[#23B573] text-white'
    } else if (category.available < 0) {
      return 'bg-[#E54545] text-white'
    } else {
      return 'bg-slate-100 text-slate-500'
    }
  }

  return (
    <>
      <div className="flex-1 overflow-auto bg-white">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <th className="px-5 py-2.5 font-semibold text-slate-500 text-[11px] uppercase tracking-wider w-[40%]">
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={() => onCheckAll?.()}
                      className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer ${
                        (() => {
                          const allIds = groups.flatMap((g: any) => g.categories.map((c: any) => c.id))
                          const all = allIds.length > 0 && allIds.every((id: string) => checkedCategoryIds?.includes(id))
                          const some = allIds.some((id: string) => checkedCategoryIds?.includes(id)) && !all
                          return all || some ? 'bg-[#5155C3] border-[#5155C3]' : 'border-slate-300 bg-white'
                        })()
                      }`}
                    >
                      {(() => {
                        const allIds = groups.flatMap((g: any) => g.categories.map((c: any) => c.id))
                        const all = allIds.length > 0 && allIds.every((id: string) => checkedCategoryIds?.includes(id))
                        const some = allIds.some((id: string) => checkedCategoryIds?.includes(id)) && !all
                        if (all) return <Check size={10} className="text-white" strokeWidth={3} />
                        if (some) return <Minus size={10} className="text-white" strokeWidth={3} />
                        return null
                      })()}
                    </div>
                    CATEGORY
                  </div>
                </th>
                <th className="px-4 py-2.5 font-semibold text-slate-400 text-[11px] uppercase tracking-widest text-right w-[13%]">Assigned</th>
                <th className="px-4 py-2.5 font-semibold text-slate-400 text-[11px] uppercase tracking-widest text-right w-[13%]">Activity</th>
                <th className="px-4 py-2.5 font-semibold text-slate-400 text-[11px] uppercase tracking-widest text-right w-[13%]">Available</th>
              </tr>
            </thead>
            <tbody>
              <SortableContext items={groups.map((g: any) => g.id)} strategy={verticalListSortingStrategy}>
                {groups.map((group: any) => {
                  const groupAssigned = group.categories.reduce((sum: number, c: any) => sum + c.assigned, 0)
                  const groupActivity = group.categories.reduce((sum: number, c: any) => sum + c.activity, 0)
                  const groupAvailable = group.categories.reduce((sum: number, c: any) => sum + c.available, 0)

                  const groupCatIds = group.categories.map((c: any) => c.id)
                  const groupAllChecked = groupCatIds.length > 0 && groupCatIds.every((id: string) => checkedCategoryIds?.includes(id))
                  const groupSomeChecked = groupCatIds.some((id: string) => checkedCategoryIds?.includes(id)) && !groupAllChecked

                  return (
                    <React.Fragment key={group.id}>
                      <SortableGroupRow 
                        id={group.id}
                        className={`cursor-pointer transition-colors border-t-2 border-t-[#888888] border-b border-b-[#CCCCCC] group/row ${selectedCategoryId === group.id ? 'bg-[#EEF2FC]' : 'bg-[#EDE9E0] hover:bg-[#E5E1D8]'}`}
                        onClick={() => { toggleGroup(group.id); onSelectCategory(group.id); }}
                        onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, 'group', group.id)}
                      >
                        {() => (
                          <>
                            <td className="px-5 py-2.5" onDoubleClick={() => {
                              setInlineEditing({ id: group.id, type: 'group', name: group.name })
                            }}>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 group-hover/row:text-slate-600 transition-colors" onClick={(e) => { e.stopPropagation(); toggleGroup(group.id) }}>
                                  {group.isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                </span>
                                
                                <div 
                                  onClick={(e) => { e.stopPropagation(); onCheckGroup?.(group.id); }}
                                  className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center border transition-colors flex-shrink-0 cursor-pointer ${groupAllChecked || groupSomeChecked ? 'bg-[#5155C3] border-[#5155C3]' : 'border-slate-300 bg-white'}`}
                                >
                                  {groupAllChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                  {groupSomeChecked && <Minus size={10} className="text-white" strokeWidth={3} />}
                                </div>
                                {inlineEditing?.id === group.id && inlineEditing?.type === 'group' ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={inlineEditing.name}
                                    onChange={(e) => setInlineEditing({ ...inlineEditing, name: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleInlineEditSubmit()
                                      if (e.key === 'Escape') setInlineEditing(null)
                                    }}
                                    onBlur={handleInlineEditSubmit}
                                    className="font-bold text-slate-800 text-[15px] bg-white border border-[#005A87] rounded px-1 outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className="font-bold text-slate-700 text-[13px] uppercase tracking-wide">{group.name}</span>
                                )}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setAddingCategoryGroupId(group.id); setNewCategoryName(""); }}
                                  className="w-[15px] h-[15px] rounded-full bg-[#5155C3] flex items-center justify-center text-white hover:bg-[#3B42A4] transition-colors shadow-sm ml-1"
                                >
                                  <Plus size={10} strokeWidth={4} />
                                </button>
                                <button 
                                  onClick={(e) => handleContextMenu(e, 'group', group.id)}
                                  className="opacity-0 group-hover/row:opacity-100 p-0.5 hover:bg-slate-300 rounded transition-all"
                                >
                                  <MoreHorizontal size={14} className="text-slate-500" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2 font-bold text-right text-slate-700 text-[13px]">
                              {formatCurrency(groupAssigned)}
                            </td>
                            <td className="px-4 py-2 font-bold text-right text-slate-700 text-[13px]">
                              {formatCurrency(groupActivity)}
                            </td>
                            <td className="px-4 py-2 font-bold text-right text-slate-700 text-[13px]">
                              {formatCurrency(groupAvailable)}
                            </td>
                          </>
                        )}
                      </SortableGroupRow>
                      
                      <AnimatePresence initial={false}>
                        {group.isExpanded && (
                          <SortableContext items={group.categories.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
                            {group.categories.map((category: any, catIndex: number) => {
                              const isSelected = selectedCategoryId === category.id
                              const isChecked = checkedCategoryIds?.includes(category.id)
                              return (
                                <SortableCategoryRow 
                                  id={category.id}
                                  key={category.id} 
                                  className={`cursor-pointer transition-colors border-b border-[#E8E4DC] group/cat ${
                                    isSelected || isChecked
                                      ? "bg-[#EEF2FC]" 
                                      : "bg-white hover:bg-[#F5F3EE]"
                                  }`}
                                  onClick={() => onSelectCategory(category.id)}
                                  onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, 'category', category.id)}
                                >
                                  {() => (
                                    <>
                                      <td className="px-5 py-2" onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (!category.linkedAccountId) {
                                          setInlineEditing({ id: category.id, type: 'category', name: category.name })
                                        }
                                      }}>
                                        <div className="flex flex-col gap-1 ml-6 relative">
                                          <div className="flex items-center gap-2">
                                            <div 
                                              onClick={(e) => { e.stopPropagation(); onCheckCategory?.(category.id); }}
                                              className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center border transition-colors flex-shrink-0 cursor-pointer ${isChecked ? 'bg-[#5155C3] border-[#5155C3]' : 'border-slate-300 bg-white'}`}
                                            >
                                              {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                            </div>
                                            <span className="font-normal text-slate-800 flex items-center gap-1.5 text-[13px]">
                                              {inlineEditing?.id === category.id && inlineEditing?.type === 'category' ? (
                                                <input
                                                  autoFocus
                                                  type="text"
                                                  value={inlineEditing.name}
                                                  onChange={(e) => setInlineEditing({ ...inlineEditing, name: e.target.value })}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleInlineEditSubmit()
                                                    if (e.key === 'Escape') setInlineEditing(null)
                                                  }}
                                                  onBlur={handleInlineEditSubmit}
                                                  className="bg-white border border-[#005A87] rounded px-1 outline-none w-32"
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              ) : (
                                                <div className="flex items-center gap-2">
                                                  <span>{category.name}</span>
                                                  {category.target > 0 && (() => {
                                                    const effectiveTarget = category.monthlyTargetAmount || category.target || 0
                                                    const under = Math.max(0, effectiveTarget - category.available)
                                                    if (under > 0) {
                                                      return <span className="text-[11px] text-slate-400 font-normal">{formatCurrency(under)} more needed this month</span>
                                                    }
                                                    return null
                                                  })()}
                                                </div>
                                              )}
                                              {category.target > 0 && <Zap size={11} className="text-[#E8A317]" />}
                                            </span>
                                          </div>
                                          {category.target > 0 && (
                                            <div className="w-20 h-1 bg-slate-200 rounded-full overflow-hidden">
                                              <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (category.available / category.target) * 100)}%` }}
                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                                className={`h-full rounded-full ${category.available >= category.target ? 'bg-[#23B573]' : 'bg-[#E8A317]'}`}
                                              />
                                            </div>
                                          )}
                                          {showProgressBars && !category.linkedAccountId && (
                                            <div className="h-[4px] bg-[#EAE8E3] rounded-full mt-1 overflow-hidden ml-[22px]" style={{ width: 'calc(100% - 22px)' }}>
                                              {(() => {
                                                const budget = category.assigned || 0
                                                const spent = Math.abs(category.activity || 0)
                                                let progress = 0
                                                let isOverspent = false
                                                
                                                if (budget > 0) {
                                                  progress = (spent / budget) * 100
                                                  if (progress > 100) {
                                                    progress = 100
                                                    isOverspent = true
                                                  }
                                                } else if (spent > 0) {
                                                  progress = 100
                                                  isOverspent = true
                                                }

                                                return progress > 0 ? (
                                                  <div 
                                                    className={`h-full rounded-full transition-all ${isOverspent ? 'bg-[#E54545]' : 'bg-[#76B928]'}`} 
                                                    style={{ width: `${progress}%` }}
                                                  />
                                                ) : null
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-5 py-2 text-right">
                                        {isSelected ? (
                                          <div className="relative inline-flex items-center justify-end w-28">
                                            <div className="absolute left-1.5 top-1.5 text-[9px] text-[#3B42A4] font-mono leading-[9px] pointer-events-none flex flex-col items-center select-none opacity-60">
                                              <div>+-</div>
                                              <div>×÷</div>
                                            </div>
                                            <input
                                              ref={assignedInputRef}
                                              autoFocus
                                              type="text"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, category.id)}
                                              onBlur={() => handleEditSubmit(category.id)}
                                              onFocus={(e) => e.target.select()}
                                              onClick={(e) => e.stopPropagation()}
                                              className="assigned-input w-full text-right pl-6 pr-2 py-1 border border-[#3B42A4] rounded outline-none shadow-sm text-[14px] text-[#3B42A4] font-semibold bg-white"
                                            />
                                          </div>
                                        ) : (
                                          <div className="inline-block px-2.5 py-0.5 rounded-md transition-colors cursor-text text-slate-700 font-medium text-[13px] border border-transparent">
                                            {formatCurrency(category.assigned)}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-right font-medium text-slate-500 text-[13px] relative">
                                        <button 
                                          onClick={(e) => handleActivityClick(e, category.id)}
                                          className="hover:underline hover:text-blue-600 transition-colors"
                                        >
                                          {formatCurrency(category.activity)}
                                        </button>
                                        
                                        <AnimatePresence>
                                          {activityPopoverId === category.id && (
                                            <motion.div
                                              initial={{ opacity: 0, y: -10 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              exit={{ opacity: 0, scale: 0.95 }}
                                              className="absolute z-[100] right-0 top-10 mt-1 w-[450px] bg-white rounded-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden cursor-default"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <div className="flex flex-col p-3 border-b border-slate-100 bg-white">
                                                <div className="flex justify-between items-center mb-1">
                                                  <h3 className="font-semibold text-slate-800 text-[15px]">Activity</h3>
                                                  <button onClick={() => setActivityPopoverId(null)} className="text-white bg-[#3B42A4] hover:bg-[#2B3180] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Close</button>
                                                </div>
                                                <div className="text-xs text-slate-500 text-left">{category.name}</div>
                                              </div>
                                              <div className="p-0 bg-slate-50 text-left">
                                                {isLoadingActivity ? (
                                                  <div className="p-6 text-center text-sm font-medium text-slate-500">Loading activity...</div>
                                                ) : activityTransactions.length === 0 ? (
                                                  <div className="p-6 text-center text-sm font-medium text-slate-500">No activity this month.</div>
                                                ) : (
                                                  <div className="max-h-[300px] overflow-y-auto">
                                                    <table className="w-full text-left text-[13px]">
                                                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                        <tr className="text-slate-500 text-[11px] uppercase tracking-wider">
                                                          <th className="px-4 py-2.5 font-semibold">Account</th>
                                                          <th className="px-4 py-2.5 font-semibold">Date</th>
                                                          <th className="px-4 py-2.5 font-semibold">Payee</th>
                                                          <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {activityTransactions.map((t, idx) => (
                                                          <tr key={t.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100 transition-colors`}>
                                                            <td className="px-4 py-2.5 text-slate-600 truncate max-w-[90px]" title={t.accountName}>{t.accountName}</td>
                                                            <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                                                            <td className="px-4 py-2.5 text-slate-800 font-medium truncate max-w-[110px]" title={t.payeeName || 'Manual Adjustment'}>{t.payeeName || 'Manual Adjustment'}</td>
                                                            <td className="px-4 py-2.5 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(t.amount)}</td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                )}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </td>
                                      <td className="px-5 py-2 text-right relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (category.available < 0) {
                                              setCoverOverspendingId(category.id)
                                            } else {
                                              onAvailableClick?.(category.id)
                                            }
                                          }}
                                          className={`
                                            inline-block px-3 py-0.5 rounded-full font-bold text-[13px] min-w-[75px] text-center transition-opacity hover:opacity-80 flex items-center justify-end gap-1 ml-auto
                                            ${getAvailableColor(category)}
                                          `}
                                        >
                                          {category.available < 0 && <span>!</span>}
                                          <span>{formatCurrency(category.available)}</span>
                                        </button>
                                        {coverOverspendingId === category.id && (
                                          <div className="absolute top-full right-5 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                            <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-slate-200 transform rotate-45"></div>
                                            <div className="relative z-10 text-left">
                                              <h3 className="text-[13px] font-bold text-slate-800 mb-2">Cover overspending from</h3>
                                              <select 
                                                className="w-full p-2 border border-slate-200 rounded-md text-[13px] outline-none focus:border-[#5155C3] bg-white text-slate-700"
                                                defaultValue=""
                                                onChange={(e) => {
                                                  const fromId = e.target.value
                                                  if (fromId) {
                                                    const amountNeeded = Math.abs(category.available)
                                                    if (onMoveMoney) {
                                                      onMoveMoney(amountNeeded, fromId, category.id)
                                                    }
                                                    setCoverOverspendingId(null)
                                                  }
                                                }}
                                              >
                                                <option value="" disabled></option>
                                                <option value="RTA">Ready to Assign</option>
                                                {groups.flatMap(g => g.categories).filter(c => c.id !== category.id).map(c => (
                                                  <option key={c.id} value={c.id}>{c.name} ({formatCurrency(c.available)})</option>
                                                ))}
                                              </select>
                                              <div className="mt-4 flex justify-end">
                                                <button 
                                                  onClick={() => setCoverOverspendingId(null)}
                                                  className="px-4 py-1.5 bg-[#EEF2FC] text-[#5155C3] font-semibold text-[13px] rounded-md hover:bg-[#E5EAF5] transition-colors"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    </>
                                  )}
                                </SortableCategoryRow>
                              )
                            })}
                          </SortableContext>
                        )}
                      </AnimatePresence>

                      {group.isExpanded && addingCategoryGroupId === group.id && (
                        <tr className="border-b border-slate-100">
                          <td colSpan={4} className="px-5 py-1">
                              <div className="flex items-center gap-2 ml-5">
                                <input
                                  autoFocus
                                  type="text"
                                  value={newCategoryName}
                                  onChange={(e) => setNewCategoryName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddCategory(group.id)
                                    if (e.key === 'Escape') { setAddingCategoryGroupId(null); setNewCategoryName("") }
                                  }}
                                  placeholder="New category name"
                                  className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5155C3] w-48"
                                />
                                <button 
                                  onClick={() => handleAddCategory(group.id)}
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-[#5155C3] rounded-md hover:bg-[#3B42A4] transition-colors"
                                >
                                  Add
                                </button>
                                <button 
                                  onClick={() => { setAddingCategoryGroupId(null); setNewCategoryName("") }}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>

      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 w-48"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {contextMenu.type === 'category' ? (() => {
                const isLinkedCC = groups.flatMap((g: any) => g.categories).find((c: any) => c.id === contextMenu.id)?.linkedAccountId;
                return (
                  <>
                    {!isLinkedCC && <button onClick={() => handleRenameCategory(contextMenu.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">Rename</button>}
                    {!isLinkedCC && <button onClick={() => handleDeleteCategory(contextMenu.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600">Delete</button>}
                  </>
                )
              })() : (
                <>
                  <button onClick={() => handleRenameGroup(contextMenu.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">Rename Group</button>
                  <button onClick={() => { setAddingCategoryGroupId(contextMenu.id); setContextMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">Add Category</button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button onClick={() => handleDeleteGroup(contextMenu.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600">Delete Group</button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
