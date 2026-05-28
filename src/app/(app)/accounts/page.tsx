import React from "react"
import { getAccounts } from "@/app/actions/accounts"
import styles from "./AccountsPage.module.css"
import { formatCurrency } from "@/lib/currency"

export default async function AccountsPage() {
  const accounts = await getAccounts()

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>All Accounts</h1>
        <div className={styles.balanceSummary}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Cleared Balance</span>
            <span className={styles.balanceValue}>{formatCurrency(totalBalance)}</span>
          </div>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Uncleared Balance</span>
            <span className={styles.balanceValue}>$0.00</span>
          </div>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Working Balance</span>
            <span className={styles.balanceValue}>{formatCurrency(totalBalance)}</span>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colAccount}>ACCOUNT</th>
              <th className={styles.colDate}>LATEST TRANSACTION</th>
              <th className={styles.colBalance}>BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <tr key={acc.id} className={styles.row}>
                <td className={styles.colAccount}>{acc.name}</td>
                <td className={styles.colDate}>
                  {acc.transactions?.[0] ? new Date(acc.transactions[0].date).toLocaleDateString() : 'No transactions'}
                </td>
                <td className={styles.colBalance}>{formatCurrency(acc.balance)}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={3} className={styles.emptyState}>
                  No accounts found. Use the sidebar to add one!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
