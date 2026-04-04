import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding initial settings and currencies...');

  // 1. Seed Currencies
  const currencies = [
    { code: 'USD', symbol: '$', exchangeRate: 1.0, isBase: true, isActive: true },
    { code: 'PKR', symbol: 'Rs', exchangeRate: 280.0, isBase: false, isActive: true },
    { code: 'AED', symbol: 'د.إ', exchangeRate: 3.67, isBase: false, isActive: true },
    { code: 'GBP', symbol: '£', exchangeRate: 0.79, isBase: false, isActive: true },
  ];

  for (const curr of currencies) {
    await prisma.currency.upsert({
      where: { code: curr.code },
      update: curr,
      create: curr,
    });
    console.log(`✅ Currency ${curr.code} seeded.`);
  }

  // 2. Seed Default Application Settings
  const defaultSettings = [
    {
      key: 'system_config',
      value: {
        companyName: 'GymAur REMS',
        companyEmail: 'admin@gymaur.com',
        companyPhone: '+92 300 0000000',
        address: 'Islamabad, Pakistan',
        defaultCurrency: 'PKR',
        numberFormat: 'full', // 'full' or 'compact'
        lastFullBackup: null,
      },
    },
    {
      key: 'notifications',
      value: {
        emailEnabled: true,
        smsEnabled: false,
        whatsappEnabled: false,
        lowInventoryAlert: true,
        paymentReminderDays: [1, 3, 7],
      },
    },
    {
      key: 'integrations',
      value: {
        sendgrid: { enabled: false, apiKeyFound: false },
        twilio: { enabled: false, sidFound: false, tokenFound: false },
        aws_s3: { enabled: false, accessKeyFound: false },
      },
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.appSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    });
    console.log(`✅ Setting ${setting.key} seeded.`);
  }

  console.log('✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
