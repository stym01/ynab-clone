import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const email = 'satyamkesharwani134@gmail.com';
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found, creating user...');
      user = await prisma.user.create({ data: { email, name: 'Satyam' } });
    }

    let budget = await prisma.budget.findFirst({ where: { userId: user.id } });
    if (!budget) {
      console.log('Budget not found, creating budget...');
      budget = await prisma.budget.create({ data: { name: 'My Budget', userId: user.id } });
    }

    const structure = [
      {
        name: 'Investing & Wealth',
        categories: [
          'Emergency Fund', 'Roth IRA', 'Brokerage / Index Funds', '401(k) / Retirement'
        ]
      },
      {
        name: 'Bills',
        categories: [
          'Mortgage Payment', 'Utilities', 'Pet Insurance', 'Spotify',
          'Car Insurance', 'Health Insurance', 'Netflix', 'Gym Membership', 'Phone & Internet'
        ]
      },
      {
        name: 'Debt Snowball',
        categories: [
          '#1 - Amex Gold Payment', '#2 - Personal Loan', '#3 - Car Loan', 'CC Interest'
        ]
      },
      {
        name: 'Fun Spending',
        categories: [
          'Nick Spending', 'Hanna Spending', 'Eating Out', 'Fast Food/ Take Out/ UberEats',
          'Entertainment', 'ATM Cash', 'Home Furnishings & Decor'
        ]
      },
      {
        name: 'Monthly Living',
        categories: [
          'Groceries (Household/ Cosmetics)', 'Amazon Shopping / Big Box', 'Gas',
          'Clothing (Essentials)', 'Pet Expenses', 'Haircuts',
          'Tithes/ Offerings/ Charitable Donations', 'Unexpected/ Junk Drawer'
        ]
      },
      {
        name: 'Kids',
        categories: [
          'Kids Clothing & Necessities', 'Piano Lessons', 'Nick Jr.', 'Hanna Jr.'
        ]
      },
      {
        name: 'Irregular & Annual',
        categories: [
          'Home Maintenance', 'Auto Maintenance', 'Next Car / Car Replacement', 'Vet Medical', 'Medical Emergency',
          'Term Life Insurance', 'YNAB Subscription', 'Amazon Prime', 'Gifts (Weddings, Birthdays, Graduations, etc.)'
        ]
      },
      {
        name: 'Short Term Savings (On Budget)',
        categories: [
          'Small Trips', 'Winter Cabin Trip 2026', 'Visiting Family for Thanksgiving', 'Christmas Spending'
        ]
      }
    ];

    let groupSortOrder = 10;
    for (const groupData of structure) {
      let group = await prisma.categoryGroup.findFirst({
        where: { budgetId: budget.id, name: groupData.name }
      });
      if (!group) {
        group = await prisma.categoryGroup.create({
          data: { budgetId: budget.id, name: groupData.name, sortOrder: groupSortOrder }
        });
      }
      
      let catSortOrder = 0;
      for (const catName of groupData.categories) {
        const existingCat = await prisma.category.findFirst({
          where: { groupId: group.id, name: catName }
        });
        if (!existingCat) {
          await prisma.category.create({
            data: { groupId: group.id, name: catName, sortOrder: catSortOrder }
          });
        }
        catSortOrder++;
      }
      groupSortOrder++;
    }
    
    return NextResponse.json({ success: true, message: 'Successfully seeded categories for ' + email });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
