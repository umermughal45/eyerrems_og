import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding singleton application settings...');

  const settings = await prisma.appSettings.findFirst();

  if (!settings) {
    await prisma.appSettings.create({
      data: {
        companyName: 'GymAurCode Real Estate',
        companyEmail: 'admin@gymaurcode.com',
        supportPhone: '+92 300 1234567',
        companyAddress: '123 Business Avenue, Suite 101, Karachi, Pakistan',
        notificationConfig: {
          emailEnabled: true,
          smsEnabled: false,
          whatsappEnabled: false
        },
        integrationConfig: {
          sendgrid: { enabled: false, apiKey: '' },
          twilio: { enabled: false, sid: '', token: '' },
          aws_s3: { enabled: false, accessKey: '', secretKey: '' }
        }
      }
    });
    console.log('Default settings created.');
  } else {
    console.log('Settings already exist.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
