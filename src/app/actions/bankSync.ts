"use server"

import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const ICICI_REGEX = /Your ICICI Bank Credit Card XX(\d+) has been used for a transaction of INR ([\d,.]+) on ([a-zA-Z]{3} \d{1,2}, \d{4}) at (\d{2}:\d{2}:\d{2})\. Info: (.*?)\./;

async function parseICICIContent(text: string) {
  const match = text.match(ICICI_REGEX);
  if (!match) return null;

  const card = match[1];
  const amountStr = match[2];
  const date = match[3];
  const time = match[4];
  const info = match[5];

  const amountPaise = Math.round(parseFloat(amountStr.replace(/,/g, '')) * 100);
  const parsedDate = new Date(`${date} ${time}`);
  
  return {
    amountPaise,
    date: parsedDate,
    payeeName: info.trim(),
    card
  };
}

export async function syncICICIEmails(accountId: string) {
  const session = await getServerSession(authOptions);
  let userId = session?.user?.id;

  // Get the FinancialAccount
  const financialAccount = await (prisma as any).financialAccount.findUnique({
    where: { id: accountId },
    include: { budget: true }
  });

  if (!financialAccount) throw new Error("Account not found");
  
  // If no session (like from webhook), use the account's budget userId
  if (!userId) {
    userId = financialAccount.budget.userId;
  }

  // Get user's Google account
  const account = await prisma.account.findFirst({
    where: { userId: userId, provider: 'google' }
  });

  if (!account || !account.refresh_token) {
    throw new Error("No Google refresh token found. Please reconnect your Google account with Gmail permissions.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  
  oauth2Client.setCredentials({ refresh_token: account.refresh_token });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Fetch recent messages
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'subject:"Transaction alert for your ICICI Bank Credit Card" newer_than:2d',
  });

  const messages = res.data.messages || [];
  let newTransactions = 0;

  for (const msg of messages) {
    console.log("Checking email ID:", msg.id);
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'full'
    });

    const payload = email.data.payload;
    let bodyText = "";

    // Extract text from multipart
    if (payload?.parts) {
      const part = payload.parts.find(p => p.mimeType === 'text/plain');
      if (part && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    } else if (payload?.body?.data) {
      bodyText = Buffer.from(payload.body.data, 'base64').toString('utf8');
    } else if (email.data.snippet) {
      // Fallback to snippet if body is entirely missing or html-only
      bodyText = email.data.snippet;
    }

    if (!bodyText && payload?.parts) {
       const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
       if (htmlPart && htmlPart.body?.data) {
         const htmlStr = Buffer.from(htmlPart.body.data, 'base64').toString('utf8');
         // Strip HTML tags roughly for regex matching
         bodyText = htmlStr.replace(/<[^>]*>?/gm, '');
       }
    }

    if (!bodyText) {
      console.log("No bodyText found for email", msg.id);
      continue;
    }

    // Clean up newlines for regex matching
    bodyText = bodyText.replace(/[\r\n]+/g, ' ');
    console.log("Cleaned bodyText length:", bodyText.length, "Snippet:", bodyText.substring(0, 100));

    const parsed = await parseICICIContent(bodyText);
    console.log("Parsed result:", parsed);
    if (parsed) {
      // Find or create payee
      let payee = await prisma.payee.findFirst({
        where: { budgetId: financialAccount.budgetId, name: parsed.payeeName }
      });
      if (!payee) {
        payee = await prisma.payee.create({
          data: { budgetId: financialAccount.budgetId, name: parsed.payeeName }
        });
      }

      const transactionAmount = -parsed.amountPaise; // outflow

      // Deduplication check
      const startOfDay = new Date(parsed.date); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(parsed.date); endOfDay.setHours(23,59,59,999);

      const existing = await prisma.transaction.findFirst({
        where: {
          accountId,
          amount: transactionAmount,
          payeeId: payee.id,
          date: { gte: startOfDay, lte: endOfDay }
        }
      });
      console.log("Existing transaction:", !!existing);

      if (!existing) {
        await prisma.transaction.create({
          data: {
            accountId,
            payeeId: payee.id,
            date: parsed.date,
            amount: transactionAmount,
            memo: `ICICI XX${parsed.card} Auto-Sync`,
            cleared: true,
          }
        });
        console.log("Created transaction!");
        
        await (prisma as any).financialAccount.update({
          where: { id: accountId },
          data: { balance: { increment: transactionAmount } }
        });
        
        newTransactions++;
      }
    }
  }

  // Update historyId
  if (res.data.historyId) {
    await (prisma as any).financialAccount.update({
      where: { id: accountId },
      data: { historyId: res.data.historyId.toString() }
    });
  }

  return { success: true, count: newTransactions };
}

export async function enableGmailWatch(accountId: string, topicName: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'google' }
  });

  if (!account || !account.refresh_token) throw new Error("No Google refresh token");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: account.refresh_token });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  if (!topicName) throw new Error("Topic Name is required");

  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName: topicName,
    }
  });

  await (prisma as any).financialAccount.update({
    where: { id: accountId },
    data: { 
      historyId: res.data.historyId?.toString(),
      syncProvider: 'ICICI_GMAIL'
    }
  });

  return { success: true, historyId: res.data.historyId };
}
