export const SENT_REGEX = /Sent Rs\.([\d,.]+) from Kotak Bank AC X(\d+) to (.+?) on (\d{2}-\d{2}-\d{2})\.UPI Ref\s*:?\s*(\d+)/i;
export const RECEIVED_REGEX = /Received Rs\.([\d,.]+) in your Kotak Bank AC X(\d+) from (.+?) on (\d{2}-\d{2}-\d{2})\.UPI Ref\s*:?\s*(\d+)/i;

export interface ParsedKotakSMS {
  type: 'SENT' | 'RECEIVED';
  amountPaise: number;
  accountTail: string;
  payeeName: string;
  date: Date;
  reference: string;
}

export function parseKotakSMS(text: string): ParsedKotakSMS | null {
  let match = text.match(SENT_REGEX);
  let type: 'SENT' | 'RECEIVED' = 'SENT';
  
  if (!match) {
    match = text.match(RECEIVED_REGEX);
    type = 'RECEIVED';
  }

  if (!match) {
    return null;
  }

  const amountStr = match[1];
  const accountTail = match[2];
  const payeeName = match[3].trim();
  const dateStr = match[4]; // DD-MM-YY
  const reference = match[5];

  // Parse amount into paise (cents)
  const amountPaise = Math.round(parseFloat(amountStr.replace(/,/g, '')) * 100);

  // Parse date
  const [day, month, shortYear] = dateStr.split('-');
  // Assume 20XX for the year
  const year = parseInt(`20${shortYear}`, 10);
  const parsedDate = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));

  return {
    type,
    amountPaise,
    accountTail,
    payeeName,
    date: parsedDate,
    reference
  };
}
