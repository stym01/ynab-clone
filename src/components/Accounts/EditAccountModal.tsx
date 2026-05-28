"use client"

import React, { useState } from "react"
import { updateAccount, closeAccount } from "@/app/actions/accounts"
import { motion } from "framer-motion"
import { X } from "lucide-react"

interface EditAccountModalProps {
  account: any
  onClose: () => void
}

export default function EditAccountModal({ account, onClose }: EditAccountModalProps) {
  const [name, setName] = useState(account.name)
  const [syncProvider, setSyncProvider] = useState(account.syncProvider || "none")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const provider = syncProvider === "none" ? null : syncProvider
      await updateAccount(account.id, name, provider)
      onClose()
    } catch (err) {
      console.error(err)
      setIsSubmitting(false)
    }
  }

  const handleCloseAccount = async () => {
    if (!confirm("Are you sure you want to close this account? It will be archived and bank sync will be disconnected.")) return
    
    setIsClosing(true)
    try {
      await closeAccount(account.id)
      onClose()
    } catch (err) {
      console.error(err)
      setIsClosing(false)
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
          <h2 className="text-xl font-bold text-slate-800">Edit Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-600">Account Nickname</label>
            <input 
              required
              autoFocus
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005a70] focus:border-transparent transition-shadow"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-600 flex items-center justify-between">
              Bank Connection
              {syncProvider === "ICICI_GMAIL" && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">LINKED</span>}
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Link your account to your financial institution and import transactions directly from Gmail without ever leaving the app.
            </p>
            <select 
              value={syncProvider} 
              onChange={e => setSyncProvider(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005a70] focus:border-transparent bg-white"
            >
              <option value="none">Unlinked (Manual entry only)</option>
              <option value="ICICI_GMAIL">ICICI Credit Card (Gmail Sync)</option>
            </select>
          </div>
          
          <div className="flex justify-between items-center mt-2 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={handleCloseAccount}
              disabled={isClosing}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
            >
              {isClosing ? "Closing..." : "Close Account"}
            </button>

            <div className="flex gap-3">
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
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
