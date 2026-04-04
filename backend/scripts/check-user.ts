/**
 * Script to check if admin user exists and verify credentials
 */

import { PrismaClient } from '@prisma/client';
import { comparePassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('🔍 Checking admin user...\n');

    // Find admin user
    const user = await prisma.user.findUnique({
      where: { email: 'admin@realestate.com' },
      include: { role: true },
    });

    if (!user) {
      console.log('❌ Admin user not found!');
      console.log('💡 Run: npm run prisma:seed');
      return;
    }

    console.log('✅ Admin user found:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role.name}`);
    console.log(`   Device Approval: ${user.deviceApprovalStatus}`);

    // Test password
    console.log('\n🔐 Testing password...');
    const isValid = await comparePassword('admin123', user.password);
    
    if (isValid) {
      console.log('✅ Password is correct!');
    } else {
      console.log('❌ Password is incorrect!');
      console.log('💡 Run: npm run prisma:seed (to reset password)');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();

