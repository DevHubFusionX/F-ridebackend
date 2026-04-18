import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEmail } from '../src/services/emailService.js';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TEST_EMAIL = process.argv[2] || 'jeeyalex7@gmail.com';
const TEMPLATE_TO_TEST = process.argv[3]; // Optional: specify a template name
const TEST_NAME = 'Alex Jee';

const templates = [
  {
    type: 'otp',
    data: {
      otp: '482931',
      name: TEST_NAME
    }
  },
  {
    type: 'welcome',
    data: {
      name: TEST_NAME,
      dashboardUrl: 'https://f-ride.app/dashboard'
    }
  },
  {
    type: 'waitlist',
    data: {
      name: TEST_NAME
    }
  },
  {
    type: 'review_pending',
    data: {
      name: TEST_NAME
    }
  },
  {
    type: 'approved',
    data: {
      name: TEST_NAME
    }
  },
  {
    type: 'receipt',
    data: {
      name: TEST_NAME,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      driverName: 'Sarah Connor',
      vehicleModel: 'Tesla Model 3',
      vehiclePlate: 'FR-2024-X',
      pickupAddress: '742 Evergreen Terrace, Springfield',
      dropoffAddress: '100 Universal City Plaza, CA',
      currency: '$',
      fare: '24.50',
      carbonSaved: '3.2'
    }
  },
  {
    type: 'security_alert',
    data: {
      name: TEST_NAME,
      deviceDetails: 'Chrome on macOS (Ventura)',
      location: 'London, United Kingdom',
      time: new Date().toLocaleString(),
      resetPasswordUrl: 'https://f-ride.app/reset-password?token=test_token'
    }
  }
];

async function runTests() {
  const templatesToRun = TEMPLATE_TO_TEST 
    ? templates.filter(t => t.type === TEMPLATE_TO_TEST)
    : templates;

  if (templatesToRun.length === 0) {
    console.error(`❌ Template "${TEMPLATE_TO_TEST}" not found.`);
    console.log(`Available templates: ${templates.map(t => t.type).join(', ')}`);
    return;
  }

  console.log('🚀 Starting Email Template Tests...');
  console.log(`📧 Recipient: ${TEST_EMAIL}`);
  if (TEMPLATE_TO_TEST) console.log(`📋 Template: ${TEMPLATE_TO_TEST}`);
  console.log('-----------------------------------------');

  for (const template of templatesToRun) {
    try {
      console.log(`⏳ Sending ${template.type} email...`);
      const result = await sendEmail(TEST_EMAIL, template.type as any, template.data);
      if (result.success) {
        console.log(`✅ ${template.type} email sent successfully!${result.mocked ? ' (MOCKED)' : ` (ID: ${result.messageId})`}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to send ${template.type} email:`, error.message);
      if (error.message.includes('You can only send testing emails to your own email address')) {
        console.log('\n> [TIP] Your Resend account is currently in test mode.');
        console.log('> To send to others, you must verify your domain or add them as a verified recipient.');
        console.log(`> Try testing with: fanyanwu83@gmail.com\n`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('-----------------------------------------');
  console.log('🏁 Email Template Tests Completed.');
}

runTests().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
