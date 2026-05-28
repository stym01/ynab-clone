/**
 * Shared currency formatting utility.
 * All money values are stored as integers in paise (1 ₹ = 100 paise).
 * Change this single file to switch currency for the entire app.
 */

export function formatCurrency(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

/**
 * Parse a user-entered string like "540.99" into paise (54099).
 * Returns 0 if the input is invalid.
 */
export function parseCurrencyInput(input: string): number {
  const parsed = parseFloat(input || '0')
  if (isNaN(parsed)) return 0
  return Math.round(parsed * 100)
}

/** Currency symbol for use in input placeholders */
export const CURRENCY_SYMBOL = '₹'
