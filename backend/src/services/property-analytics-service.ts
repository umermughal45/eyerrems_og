import prisma from '../prisma/client';

export interface PropertyProfitabilityReport {
    propertyId: string | null;
    propertyName: string;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
}

export async function generatePropertyProfitabilityReport(
    startDate: Date,
    endDate: Date,
    propertyId?: string
): Promise<PropertyProfitabilityReport[]> {
    const where: any = {
        date: {
            gte: startDate,
            lte: endDate,
        },
        isDeleted: false,
    };

    if (propertyId) {
        where.propertyId = propertyId;
    }

    // Fetch all relevant ledger entries
    const entries = await prisma.financeLedger.findMany({
        where,
        include: {
            Property: {
                select: {
                    name: true,
                    propertyCode: true,
                },
            },
        },
    });

    // Group by property
    const propertyMap = new Map<string, PropertyProfitabilityReport>();

    // If propertyId is provided, ensure we have an entry for it
    if (propertyId) {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { name: true },
        });
        if (property) {
            propertyMap.set(propertyId, {
                propertyId: propertyId,
                propertyName: property.name,
                totalIncome: 0,
                totalExpenses: 0,
                netProfit: 0,
                transactionCount: 0,
            });
        }
    }

    // Helper to get or create report entry
    const getReportEntry = (pId: string | null, pName: string) => {
        const key = pId || 'unassigned';
        if (!propertyMap.has(key)) {
            propertyMap.set(key, {
                propertyId: pId,
                propertyName: pName,
                totalIncome: 0,
                totalExpenses: 0,
                netProfit: 0,
                transactionCount: 0,
            });
        }
        return propertyMap.get(key)!;
    };

    for (const entry of entries) {
        const pName = entry.Property?.name || (entry.propertyId ? 'Unknown Property' : 'Unassigned');
        const report = getReportEntry(entry.propertyId, pName);

        // Determine if income or expense
        // Category: 'credit' = Income, 'debit' = Expense
        // Or check referenceType for specific logic if categories are mixed
        /*
          Standard Accounting for Asset/Expense Accounts (Debit is +, Credit is -)
          Standard Accounting for Liability/Equity/Income Accounts (Credit is +, Debit is -)
          
          Here, FinanceLedger seems to be a mixed bag or a single journal. 
          Let's assume:
          - Invoices (Income) -> Credit
          - Payments (Income) -> Credit
          - Expenses -> Debit
          - Maintenance -> Debit
        */

        const amount = entry.amount || 0;

        // We rely on category field
        if (entry.category === 'credit' || entry.category === 'income') {
            report.totalIncome += amount;
            report.netProfit += amount;
        } else if (entry.category === 'debit' || entry.category === 'expense') {
            report.totalExpenses += amount;
            report.netProfit -= amount;
        }

        report.transactionCount++;
    }

    return Array.from(propertyMap.values());
}
