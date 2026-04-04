
import { PrismaClient } from '@prisma/client';
import { generatePropertyProfitabilityReport } from '../src/services/property-analytics-service';
import { syncInvoiceToFinanceLedger, syncPropertyExpenseToFinanceLedger, syncMaintenanceToFinanceLedger } from '../src/services/workflows';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting verification...');

    // 1. Create a Test Property
    const propertyCode = `TEST-PROP-${Date.now()}`;
    const property = await prisma.property.create({
        data: {
            name: 'Profitability Test Property',
            type: 'Residential',
            address: '123 Test St',
            propertyCode,
            status: 'Vacant',
            tid: `TID-${Date.now()}`,
        },
        select: {
            id: true,
            name: true,
            propertyCode: true,
        }
    });
    console.log('Created Property:', property.id);

    try {
        // 2. Create an Expense ($500)
        const expense = await prisma.propertyExpense.create({
            data: {
                propertyId: property.id,
                category: 'maintenance',
                amount: 500,
                date: new Date(),
                description: 'Test Expense',
            },
        });
        // Manually trigger sync (since we are not running the full app server)
        await syncPropertyExpenseToFinanceLedger(expense.id);
        console.log('Created Expense and Synced:', expense.id);

        // 3. Create a Maintenance Request ($200)
        const maintenance = await prisma.maintenanceRequest.create({
            data: {
                propertyId: property.id,
                issueTitle: 'Test Issue',
                issueDescription: 'Fixing something',
                priority: 'medium',
                status: 'completed',
                actualCost: 200,
                completedAt: new Date(),
            },
        });
        await syncMaintenanceToFinanceLedger(maintenance.id);
        console.log('Created Maintenance and Synced:', maintenance.id);

        // 4. Create an Invoice ($1000) - e.g. Rent
        // Need a tenant first? Invoice can be created without tenant in schema but usually needs one.
        // Let's create dummy tenant.
        // Skipped tenant creation to avoid foreign key constraints with Unit.
        // Creating invoice without tenant for this test.
        // Actually tenant creation is complex due to unit relation. 
        // Let's create invoice without tenant if allowed by schema (tenantId String?). Yes.

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: `INV-${Date.now()}`,
                propertyId: property.id,
                amount: 1000,
                totalAmount: 1000,
                remainingAmount: 1000,
                billingDate: new Date(),
                dueDate: new Date(),
                status: 'unpaid',
            },
        });
        await syncInvoiceToFinanceLedger(invoice.id);
        console.log('Created Invoice and Synced:', invoice.id);

        // 5. Run Report
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 1);

        const report = await generatePropertyProfitabilityReport(startDate, endDate, property.id);
        console.log('Report Result:', JSON.stringify(report, null, 2));

        // 6. Verify assertions
        const pReport = report.find(r => r.propertyId === property.id);
        if (!pReport) {
            throw new Error('Property not found in report');
        }

        const expectedIncome = 1000;
        const expectedExpense = 500 + 200;
        const expectedNet = 1000 - 700;

        if (pReport.totalIncome !== expectedIncome) {
            console.error(`Expected Income: ${expectedIncome}, Got: ${pReport.totalIncome}`);
        }
        if (pReport.totalExpenses !== expectedExpense) {
            console.error(`Expected Expenses: ${expectedExpense}, Got: ${pReport.totalExpenses}`);
        }
        if (pReport.netProfit !== expectedNet) {
            console.error(`Expected Net Profit: ${expectedNet}, Got: ${pReport.netProfit}`);
        }

        if (pReport.totalIncome === expectedIncome && pReport.totalExpenses === expectedExpense) {
            console.log('SUCCESS: All numbers match!');
        } else {
            throw new Error('Verification Failed');
        }

    } catch (e) {
        console.error('Verification Error:', e);
    } finally {
        // Cleanup
        // (Optional) Soft delete property...
        await prisma.property.update({
            where: { id: property.id },
            data: { isDeleted: true },
        });
        console.log('Cleanup done.');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
