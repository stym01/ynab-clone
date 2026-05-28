"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronDown, Zap, Plus, MoreHorizontal, Check, Minus } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { addCategory, renameCategory, deleteCategory, renameCategoryGroup, deleteCategoryGroup } from "@/app/actions/budget"

interface BudgetTableProps {
  groups: any[]
  setGroups: React.Dispatch<React.SetStateAction<any[]>>
  selectedCategoryId: string | null
  onSelectCategory: (id: string) => void
  onUpdateAssigned: (categoryId: string, amount: number) => Promise<void>
  onAvailableClick?: (categoryId: string) => void
  onMoveMoney?: (amountCents: number, fromId: string, toId: string) => Promise<void>
}

export default function BudgetTable({ 
  groups, setGroups, selectedCategoryId, onSelectCategory, onUpdateAssigned, onAvailableClick, onMoveMoney
}: BudgetTableProps) {
  
  const [editValue, setEditValue] = useState<string>("")
  const [coverOverspendingId, setCoverOverspendingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ type: 'category' | 'group', id: string, x: number, y: number } | null>(null)
  const [addingCategoryGroupId, setAddingCategoryGroupId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")

  const [inlineEditing, setInlineEditing] = useState<{ id: string, type: 'category' | 'group', name: string } | null>(null)

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
    await addCategory(groupId, newCategoryName.trim())
    setNewCategoryName("")
    setAddingCategoryGroupId(null)
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

  // Available pill color logic
  const getAvailableColor = (category: any) => {
    if (category.available > 0 && category.target > 0 && category.available < category.target) {
      return 'bg-[#E8A317] text-white' // Yellow: partially funded
    } else if (category.available > 0) {
      return 'bg-[#23B573] text-white' // Green: fully funded
    } else if (category.available < 0) {
      return 'bg-[#E54545] text-white' // Red: overspent
    } else {
      return 'bg-slate-100 text-slate-500' // Gray: zero
    }
  }

  return (
    <>
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
            <tr>
              <th className="px-5 py-2.5 font-semibold text-slate-500 text-[11px] uppercase tracking-wider w-[40%]">
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-[3px] border border-slate-300 flex-shrink-0 bg-white"></div>
                  CATEGORY
                </div>
              </th>
              <th className="px-5 py-2.5 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-right w-[20%]">Assigned</th>
              <th className="px-5 py-2.5 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-right w-[20%]">Activity</th>
              <th className="px-5 py-2.5 font-semibold text-slate-500 text-[11px] uppercase tracking-wider text-right w-[20%]">Available</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group: any) => {
              const groupAssigned = group.categories.reduce((sum: number, c: any) => sum + c.assigned, 0)
              const groupActivity = group.categories.reduce((sum: number, c: any) => sum + c.activity, 0)
              const groupAvailable = group.categories.reduce((sum: number, c: any) => sum + c.available, 0)

              const hasSelectedChild = group.categories.some((c: any) => c.id === selectedCategoryId)

              return (
                <React.Fragment key={group.id}>
                  {/* Group Header Row */}
                  <tr 
                    className={`cursor-pointer transition-all border-b border-slate-200 group/row ${selectedCategoryId === group.id ? 'bg-[#E5E7FF]' : 'bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50'}`}
                    onClick={() => { toggleGroup(group.id); onSelectCategory(group.id); }}
                    onContextMenu={(e) => handleContextMenu(e, 'group', group.id)}
                  >
                    <td className="px-5 py-2.5" onDoubleClick={() => {
                      setInlineEditing({ id: group.id, type: 'group', name: group.name })
                    }}>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 group-hover/row:text-slate-600 transition-colors" onClick={(e) => { e.stopPropagation(); toggleGroup(group.id) }}>
                          {group.isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </span>
                        
                        <div className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center border transition-colors flex-shrink-0 ${hasSelectedChild || selectedCategoryId === group.id ? 'bg-[#5155C3] border-[#5155C3]' : 'border-slate-300 bg-white'}`}>
                          {(hasSelectedChild || selectedCategoryId === group.id) && <Minus size={10} className="text-white" strokeWidth={3} />}
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
                            className="font-bold text-slate-700 text-[13px] uppercase tracking-wide bg-white border border-[#005A87] rounded px-1 outline-none"
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
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-all"
                        >
                          <MoreHorizontal size={14} className="text-slate-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 font-semibold text-right text-slate-600 text-[13px]">
                      {formatCurrency(groupAssigned)}
                    </td>
                    <td className="px-5 py-2.5 font-semibold text-right text-slate-600 text-[13px]">
                      {formatCurrency(groupActivity)}
                    </td>
                    <td className="px-5 py-2.5 font-semibold text-right text-slate-600 text-[13px]">
                      {formatCurrency(groupAvailable)}
                    </td>
                  </tr>
                  
                  {/* Category Rows */}
                  <AnimatePresence initial={false}>
                    {group.isExpanded && group.categories.map((category: any, catIndex: number) => {
                      const isSelected = selectedCategoryId === category.id
                      return (
                        <motion.tr 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.12 }}
                          key={category.id} 
                          className={`cursor-pointer transition-all border-b border-slate-50 group/cat ${
                            isSelected 
                              ? "bg-[#E5E7FF] border-l-2 border-l-[#005A87]" 
                              : catIndex % 2 === 1 
                                ? "bg-slate-50/30 hover:bg-blue-50/30 border-l-2 border-l-transparent" 
                                : "hover:bg-blue-50/30 border-l-2 border-l-transparent"
                          }`}
                          onClick={() => onSelectCategory(category.id)}
                          onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
                        >
                          <td className="px-5 py-2" onDoubleClick={() => {
                            setInlineEditing({ id: category.id, type: 'category', name: category.name })
                          }}>
                            <div className="flex flex-col gap-1 ml-5">
                              <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center border transition-colors flex-shrink-0 ${isSelected ? 'bg-[#5155C3] border-[#5155C3]' : 'border-slate-300 bg-white'}`}>
                                  {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                </div>
                                <span className="font-medium text-slate-700 flex items-center gap-1.5 text-[13px]">
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
                                  category.name
                                )}
                                {category.target > 0 && <Zap size={11} className="text-[#E8A317]" />}
                              </span>
                              </div>
                              {/* Progress Bar */}
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
                                  className="assigned-input w-full text-right pl-6 pr-2 py-1 border border-[#3B42A4] rounded outline-none shadow-sm text-[13px] text-[#3B42A4] font-semibold bg-white"
                                />
                              </div>
                            ) : (
                              <div className="inline-block px-2.5 py-0.5 rounded-md transition-colors cursor-text text-slate-700 font-medium text-[13px] border border-transparent">
                                {formatCurrency(category.assigned)}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-2 text-right font-medium text-slate-500 text-[13px]">
                            {formatCurrency(category.activity)}
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
                                inline-block px-3 py-0.5 rounded-full font-bold text-[12px] min-w-[80px] text-center transition-opacity hover:opacity-80 flex items-center justify-end gap-1 ml-auto
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
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>

                  {/* Add Category Row */}
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
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
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
              {contextMenu.type === 'category' ? (
                <>
                  <button onClick={() => handleRenameCategory(contextMenu.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">Rename</button>
                  <button onClick={() => handleDeleteCategory(contextMenu.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600">Delete</button>
                </>
              ) : (
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
