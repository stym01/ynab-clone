import React, { useState } from "react"
import { motion } from "framer-motion"

interface MoveMoneyModalProps {
  onClose: () => void
  onMove: (amount: number, fromId: string, toId: string) => Promise<void>
  categories: any[]
  initialFromId?: string
}

export default function MoveMoneyModal({ onClose, onMove, categories, initialFromId }: MoveMoneyModalProps) {
  const [amount, setAmount] = useState("")
  const [fromId, setFromId] = useState(initialFromId || "")
  const [toId, setToId] = useState("")
  const [isMoving, setIsMoving] = useState(false)

  const handleMove = async () => {
    if (!amount || !fromId || !toId || fromId === toId) return
    setIsMoving(true)
    const amountCents = Math.round(parseFloat(amount) * 100)
    await onMove(amountCents, fromId, toId)
    setIsMoving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-slate-200">Move Money</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 dark:text-slate-500">&times;</button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Amount</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">₹</span>
              <input 
                type="number" step="0.01" 
                value={amount} onChange={e => setAmount(e.target.value)}
                autoFocus
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded focus:border-[#005A87] focus:ring-1 focus:ring-[#005A87] outline-none" 
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">From</label>
            <select 
              value={fromId} onChange={e => setFromId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded focus:border-[#005A87] outline-none text-sm"
            >
              <option value="">Select category...</option>
              <option value="RTA" className="font-bold">Ready to Assign</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">To</label>
            <select 
              value={toId} onChange={e => setToId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded focus:border-[#005A87] outline-none text-sm"
            >
              <option value="">Select category...</option>
              <option value="RTA" className="font-bold">Ready to Assign</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800">Cancel</button>
          <button onClick={handleMove} disabled={isMoving || !amount || !fromId || !toId || fromId === toId} className="px-4 py-2 text-sm font-medium text-white bg-[#005A87] rounded hover:bg-[#004566] disabled:opacity-50">OK</button>
        </div>
      </motion.div>
    </div>
  )
}
