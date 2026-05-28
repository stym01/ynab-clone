const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'test@ynab.local' },
    update: {},
    create: {
      email: 'test@ynab.local',
      name: 'Test User',
      password: hashedPassword,
      budgets: {
        create: {
          name: 'My Awesome Budget'
        }
      }
    },
  })
  
  console.log('Seed completed. Test user created:', user.email, 'password: password123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
