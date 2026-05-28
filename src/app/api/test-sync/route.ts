import { NextResponse } from 'next/server';
import { syncICICIEmails } from '@/app/actions/bankSync';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" });
    }

    const originalConsoleLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalConsoleLog(...args);
    };

    await syncICICIEmails(accountId);

    console.log = originalConsoleLog;

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
