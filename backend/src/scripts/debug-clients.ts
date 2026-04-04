
import prisma from '../prisma/client';

async function main() {
  const clients = await prisma.client.findMany({
    take: 5,
  });
  console.log('Clients:', JSON.stringify(clients, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
