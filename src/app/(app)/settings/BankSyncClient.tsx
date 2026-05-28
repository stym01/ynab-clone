"use client"

import React, { useState } from "react"
import { signIn } from "next-auth/react"
import { enableGmailWatch } from "@/app/actions/bankSync"

export default function BankSyncClient({ accounts, hasGoogleOauth }: { accounts: any[], hasGoogleOauth: boolean }) {
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [topicName, setTopicName] = useState("projects/your-project/topics/gmail-push")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const handleConnect = async () => {
    if (!selectedAccountId) {
      setStatus({ type: 'error', message: "Please select an account first." })
      return
    }
    
    setIsLoading(true)
    setStatus(null)
    try {
      await enableGmailWatch(selectedAccountId, topicName)
      setStatus({ type: 'success', message: "Successfully subscribed to real-time Gmail push notifications!" })
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || "An error occurred." })
    }
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {!hasGoogleOauth ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm mb-3">
            <strong>Action Required:</strong> You need to sign in with Google to grant Gmail read permissions before you can set up Bank Sync.
          </p>
          <button 
            onClick={() => signIn('google')}
            className="px-4 py-2 bg-white text-slate-800 border border-slate-300 rounded font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">1. Select Account to Sync</label>
            <select 
              value={selectedAccountId} 
              onChange={e => setSelectedAccountId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#005A87]/50"
            >
              <option value="">-- Choose Account --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.syncProvider ? `Currently: ${acc.syncProvider}` : 'No Sync'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">2. Google Cloud Pub/Sub Topic</label>
            <input 
              type="text" 
              value={topicName}
              onChange={e => setTopicName(e.target.value)}
              placeholder="projects/.../topics/..."
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#005A87]/50"
            />
            <p className="text-xs text-slate-500 max-w-md mt-1">
              You must create a Pub/Sub topic in GCP, grant <code>gmail-api-push@system.gserviceaccount.com</code> publish rights, and set up a Push Subscription to your ngrok URL.
            </p>
          </div>

          <div>
            <button 
              onClick={handleConnect}
              disabled={isLoading || !selectedAccountId}
              className="px-6 py-2.5 bg-[#005A87] text-white rounded-md font-semibold hover:bg-[#004a70] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? "Connecting..." : "Enable Real-Time Sync"}
            </button>
          </div>

          {status && (
            <div className={`p-4 rounded-md text-sm font-medium ${status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {status.message}
            </div>
          )}
        </>
      )}
    </div>
  )
}
