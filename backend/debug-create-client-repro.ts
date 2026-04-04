
import prisma from './src/prisma/client';

async function main() {
    console.log('Starting FULL payload client creation test...');

    try {
        // Mimic the payload from AddClientDialog EXACTLY
        const payload = {
            name: "Test Client Full Payload",
            tid: "TID-FULL-001",
            email: "testfull@example.com",
            phone: "1234567890",
            company: "Test Company",
            status: "active",
            cnic: "12345-6789012-4",
            address: "123 Test St",
            city: "Test City",
            country: "Test Country",
            postalCode: "12345",
            clientType: "individual",
            clientCategory: "regular",
            propertyInterest: "buy",
            billingAddress: "123 Billing St",
            attachments: {
                notes: "Test notes",
                files: [
                    { name: "test.txt", url: "data:text/plain;base64,SGVsbG8=", type: "text/plain", size: 5 }
                ]
            },
            tags: ["test-tag", "vip"],
            // assignedAgentId: undefined, // undefined are not added in frontend
            // assignedDealerId: undefined,
            // manualUniqueId: undefined,
        };

        console.log('Attempting create with full payload...');

        // Simulate server side logic from crm.ts
        const nextSrNo = 8888;
        const nextClientNo = 'CL-8888';
        const clientCode = 'cli-25-8888';
        const userId = "test-user-id";

        // Note: crm.ts SPREADS the payload. 
        // data: { ...clientData, isDeleted: false, createdBy: ... }

        // NOTE: My PREVIOUS fix changed userId -> createdBy. 
        // If I test with userId here, it SHOULD fail. 
        // If I test with createdBy, it SHOULD pass.

        // I will test with createdBy (valid) to ensure the REST of the payload is valid.

        const result = await prisma.client.create({
            data: {
                ...payload,
                clientCode,
                manualUniqueId: null,
                srNo: nextSrNo,
                clientNo: nextClientNo,
                isDeleted: false,
                createdBy: userId, // Correct field name
            },
        });

        console.log('✅ Client created successfully:', result.id);
    } catch (error: any) {
        console.log('\n\n❌ ERROR START ❌');
        console.log(error.message);
        if (error.meta) console.log(JSON.stringify(error.meta, null, 2));
        console.log('❌ ERROR END ❌\n\n');
    } finally {
        await prisma.$disconnect();
    }
}

main();
