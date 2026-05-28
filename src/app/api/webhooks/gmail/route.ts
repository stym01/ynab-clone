import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncICICIEmails } from '@/app/actions/bankSync';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.message || !body.message.data) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const dataStr = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const data = JSON.parse(dataStr);
    console.log("Webhook payload parsed:", data);

    // PubSub data for Gmail watch contains emailAddress and historyId
    if (!data.emailAddress) {
      return NextResponse.json({ error: "No email address" }, { status: 400 });
    }

    // Find ALL financial accounts linked to ICICI_GMAIL
    // Since NextAuth links accounts without changing the User's primary email,
    // data.emailAddress from Google won't necessarily match user.email.
    // For this personal app, we can just trigger a sync on all ICICI accounts.
    const accounts = await (prisma as any).financialAccount.findMany({
      where: {
        syncProvider: 'ICICI_GMAIL'
      },
      include: { budget: true }
    });

    console.log("Found ICICI accounts:", accounts.length);

    // Trigger sync for each
    for (const acc of accounts) {
      console.log("Triggering sync for account:", acc.id);
      await syncICICIEmails(acc.id).catch(err => {
        console.error(`Sync failed for account ${acc.id}:`, err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
