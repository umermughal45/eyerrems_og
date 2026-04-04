
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Try to use select for Property but include for Units
        // We just want to see if it compiles/runs, we don't need real data necessarily matching
        // But we need a valid ID or just findFirst
        const property = await prisma.property.findFirst({
            select: {
                id: true,
                name: true,
                // Try to use include inside a relation field call
                // According to docs, we can't do "units: { include: ... }" inside select directly
                // But let's verify if we can do "units: { select: { id: true, tenant: true } }" 
                // where tenant is a relation.
                units: {
                    select: {
                        id: true,
                        // If we select a relation, do we get the scalars of that relation?
                        // Or works logically like include?
                        tenant: true // This should load the tenant relation
                    }
                }
            }
        });
        console.log('Query successful');
        console.log(JSON.stringify(property, null, 2));
    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
