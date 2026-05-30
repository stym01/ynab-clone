import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseKotakSMS } from '@/lib/parsers/kotak';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Ensure we have a secret configured and provided
    if (!process.env.SMS_WEBHOOK_SECRET) {
      console.error("SMS_WEBHOOK_SECRET is not set in environment");
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (secret !== process.env.SMS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const text = body.message || body.text || '';

    if (!text) {
      return NextResponse.json({ error: 'Missing message body' }, { status: 400 });
    }

    const parsed = parseKotakSMS(text);

    if (!parsed) {
      console.log("Could not parse SMS:", text);
      return NextResponse.json({ message: 'Ignored: Not a recognized transaction SMS' }, { status: 200 });
    }

    // Look for a FinancialAccount that is configured for this SMS sync
    // The user should set the syncProvider on the account to e.g. "KOTAK_SMS_6065"
    const expectedSyncProvider = `KOTAK_SMS_${parsed.accountTail}`;
    const account = await (prisma as any).financialAccount.findFirst({
      where: { syncProvider: expectedSyncProvider }
    });

    if (!account) {
      console.log("Could not find account for syncProvider:", expectedSyncProvider);
      return NextResponse.json({ error: `Account matching ${expectedSyncProvider} not found` }, { status: 404 });
    }

    // Amount is outflow if SENT, inflow if RECEIVED
    const transactionAmount = parsed.type === 'SENT' ? -parsed.amountPaise : parsed.amountPaise;

    // Find or create payee
    let payee = await prisma.payee.findFirst({
      where: { budgetId: account.budgetId, name: parsed.payeeName }
    });

    if (!payee) {
      payee = await prisma.payee.create({
        data: { budgetId: account.budgetId, name: parsed.payeeName }
      });
    }

    // Deduplication check
    const startOfDay = new Date(parsed.date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(parsed.date); endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.transaction.findFirst({
      where: {
        accountId: account.id,
        amount: transactionAmount,
        payeeId: payee.id,
        date: { gte: startOfDay, lte: endOfDay }
      }
    });

    if (existing) {
      console.log("Transaction already exists:", existing.id);
      return NextResponse.json({ message: 'Transaction already exists', id: existing.id }, { status: 200 });
    }

    // Create the transaction
    const transaction = await prisma.transaction.create({
      data: {
        accountId: account.id,
        payeeId: payee.id,
        date: parsed.date,
        amount: transactionAmount,
        memo: `Kotak UPI Ref: ${parsed.reference}`,
        cleared: true,
      }
    });

    // Update account balance
    await (prisma as any).financialAccount.update({
      where: { id: account.id },
      data: { balance: { increment: transactionAmount } }
    });

    console.log("Successfully created transaction from SMS:", transaction.id);
    return NextResponse.json({ success: true, id: transaction.id }, { status: 200 });

  } catch (error) {
    console.error("Error processing SMS webhook:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
