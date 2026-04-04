import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Property table columns...');
    try {
        const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Property';
    `;
        console.log(JSON.stringify(result, null, 2));

        // Explicitly check for amenities
        const hasAmenities = (result as any[]).some(r => r.column_name === 'amenities');
        console.log('Has amenities column:', hasAmenities);

        const hasDocuments = (result as any[]).some(r => r.column_name === 'documents');
        console.log('Has documents column:', hasDocuments);

    } catch (error) {
        console.error('Error querying information_schema:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
