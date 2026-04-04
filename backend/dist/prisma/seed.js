"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = __importDefault(require("./client"));
const password_1 = require("../utils/password");
async function main() {
    console.log('🌱 Seeding database...');
    // Create default roles
    const adminRole = await client_1.default.role.upsert({
        where: { name: 'Admin' },
        update: {},
        create: {
            name: 'Admin',
            permissions: ['*'], // All permissions
        },
    });
    const hrManagerRole = await client_1.default.role.upsert({
        where: { name: 'HR Manager' },
        update: {},
        create: {
            name: 'HR Manager',
            permissions: ['hr.view', 'hr.create', 'hr.update', 'hr.delete'],
        },
    });
    const dealerRole = await client_1.default.role.upsert({
        where: { name: 'Dealer' },
        update: {},
        create: {
            name: 'Dealer',
            permissions: ['crm.view', 'crm.create', 'crm.update', 'properties.view'],
        },
    });
    const tenantRole = await client_1.default.role.upsert({
        where: { name: 'Tenant' },
        update: {},
        create: {
            name: 'Tenant',
            permissions: ['tenant.view', 'tenant.update'],
        },
    });
    const accountantRole = await client_1.default.role.upsert({
        where: { name: 'Accountant' },
        update: {},
        create: {
            name: 'Accountant',
            permissions: ['finance.view', 'finance.create', 'finance.update', 'finance.delete'],
        },
    });
    // Create default admin user
    const adminPassword = await (0, password_1.hashPassword)('admin123');
    const adminUser = await client_1.default.user.upsert({
        where: { email: 'admin@realestate.com' },
        update: {
            // Update password if user already exists (in case it was changed)
            password: adminPassword,
            roleId: adminRole.id,
            deviceApprovalStatus: 'approved',
        },
        create: {
            username: 'admin',
            email: 'admin@realestate.com',
            password: adminPassword,
            roleId: adminRole.id,
            deviceApprovalStatus: 'approved',
        },
    });
    // Create default departments
    const departments = [
        { code: 'ENG', name: 'Engineering', description: 'Software Development and Engineering' },
        { code: 'SAL', name: 'Sales', description: 'Sales and Business Development' },
        { code: 'MKT', name: 'Marketing', description: 'Marketing and Public Relations' },
        { code: 'HR', name: 'Human Resources', description: 'HR and Talent Acquisition' },
        { code: 'FIN', name: 'Finance', description: 'Finance and Accounting' },
        { code: 'OPS', name: 'Operations', description: 'Operations and Logistics' },
    ];
    for (const dept of departments) {
        await client_1.default.department.upsert({
            where: { code: dept.code },
            update: {},
            create: dept,
        });
    }
    // Seed Expanded Chart of Accounts (load compiled JS to satisfy tsconfig rootDir)
    const path = await Promise.resolve().then(() => __importStar(require('path')));
    const expandedSeedsPath = path.resolve(process.cwd(), 'prisma', 'seeds', 'chart-of-accounts.js');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expandedSeeds = require(expandedSeedsPath);
    if (expandedSeeds && typeof expandedSeeds.seedExpandedChartOfAccounts === 'function') {
        await expandedSeeds.seedExpandedChartOfAccounts();
    }
    console.log('✅ Seeding completed!');
    console.log('📧 Admin credentials:');
    console.log('   Email: admin@realestate.com');
    console.log('   Password: admin123');
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await client_1.default.$disconnect();
});
//# sourceMappingURL=seed.js.map