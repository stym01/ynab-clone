"use client"

import React, { useState } from "react"
import { createAccount } from "@/app/actions/accounts"
import { motion } from "framer-motion"
import { X } from "lucide-react"

interface AddAccountModalProps {
  onClose: () => void
}

export default function AddAccountModal({ onClose }: AddAccountModalProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState("checking")
  const [balance, setBalance] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const balanceCents = Math.round(parseFloat(balance || "0") * 100)
      await createAccount(name, type, balanceCents)
      onClose()
    } catch (err) {
      console.error(err)
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Add Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-600">Nickname</label>
            <input 
              required
              autoFocus
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chase Checking"
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005a70] focus:border-transparent transition-shadow"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-600">Account Type</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005a70] focus:border-transparent bg-white"
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="creditCard">Credit Card</option>
              <option value="icici_credit">ICICI Credit Card (Auto-Sync)</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-600">Current Balance</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
              <input 
                required
                type="number" 
                step="0.01"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005a70] focus:border-transparent transition-shadow"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">If you owe money, enter a negative amount.</p>
          </div>
          
          <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#005a70] hover:bg-[#004758] rounded-md transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
            >
              {isSubmitting ? "Saving..." : "Save Account"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
