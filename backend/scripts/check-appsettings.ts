import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const settings = await prisma.appSettings.findFirst();
    console.log("SUCCESS: Settings exist.", settings);
    
    // Check EmailMessage too
    const count = await prisma.emailMessage.count();
    console.log("SUCCESS: EmailMessage exists. Count:", count);
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}
main().then(() => prisma.$disconnect());
