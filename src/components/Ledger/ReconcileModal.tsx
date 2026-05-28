"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { formatCurrency, CURRENCY_SYMBOL } from "@/lib/currency"

interface ReconcileModalProps {
  onClose: () => void
  clearedBalance: number
  accountId: string
  onCreateAdjustment: (amountCents: number) => Promise<void>
}

export default function ReconcileModal({ onClose, clearedBalance, accountId, onCreateAdjustment }: ReconcileModalProps) {
  const [bankBalance, setBankBalance] = useState("")
  const [step, setStep] = useState<"ENTER_BALANCE" | "SUCCESS" | "ADJUSTMENT">("ENTER_BALANCE")
  const [isAdjusting, setIsAdjusting] = useState(false)



  const handleNext = () => {
    const inputCents = Math.round(parseFloat(bankBalance || "0") * 100)
    if (inputCents === clearedBalance) {
      setStep("SUCCESS")
    } else {
      setStep("ADJUSTMENT")
    }
  }

  const handleAdjustment = async () => {
    setIsAdjusting(true)
    const inputCents = Math.round(parseFloat(bankBalance || "0") * 100)
    const difference = inputCents - clearedBalance
    await onCreateAdjustment(difference)
    setStep("SUCCESS")
    setIsAdjusting(false)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Reconcile Account</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 dark:text-slate-500 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {step === "ENTER_BALANCE" && (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-slate-600 dark:text-slate-400 dark:text-slate-500">Enter your current actual bank balance.</p>
              <div className="relative max-w-xs mx-auto w-full">
                <span className="absolute left-3 top-3 text-slate-400 dark:text-slate-500 font-bold">{CURRENCY_SYMBOL}</span>
                <input 
                  type="number"
                  step="0.01"
                  value={bankBalance}
                  onChange={(e) => setBankBalance(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 text-xl font-bold border-2 border-[#005a70] rounded-lg outline-none focus:ring-4 focus:ring-blue-100 text-center"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <button 
                onClick={handleNext}
                className="mt-2 w-full py-3 bg-[#005a70] text-white font-bold rounded-lg hover:bg-[#004252] transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="flex flex-col gap-4 text-center items-center">
              <div className="w-16 h-16 bg-green-100 text-[#00a35c] rounded-full flex items-center justify-center text-3xl mb-2">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Balances Match!</h3>
              <p className="text-slate-600 dark:text-slate-400 dark:text-slate-500">Your account is reconciled and up-to-date.</p>
              <button 
                onClick={onClose}
                className="mt-4 w-full py-3 bg-[#00a35c] text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {step === "ADJUSTMENT" && (
            <div className="flex flex-col gap-4 text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center text-3xl mb-2 mx-auto">
                !
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">There is a difference</h3>
              <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Cleared Balance:</span>
                  <span className="font-bold">{formatCurrency(clearedBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Actual Balance:</span>
                  <span className="font-bold">{formatCurrency(Math.round(parseFloat(bankBalance || "0") * 100))}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">Difference:</span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(Math.round(parseFloat(bankBalance || "0") * 100) - clearedBalance)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                We can create an adjustment transaction to make your balances match.
              </p>
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => setStep("ENTER_BALANCE")}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 dark:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={handleAdjustment}
                  disabled={isAdjusting}
                  className="flex-1 py-3 bg-[#005a70] text-white font-bold rounded-lg hover:bg-[#004252] transition-colors"
                >
                  {isAdjusting ? "Adjusting..." : "Create Adjustment"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
