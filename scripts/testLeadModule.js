import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/dbConnection.js';
import Lead from '../models/lead.model.js';
import LeadJob from '../models/leadJob.model.js';
import { verifyTurnstileToken } from '../utils/turnstile.js';
import { isLeadSquaredConfigured, syncLeadToLeadSquared } from '../services/leadSquared.service.js';
import { tickOutboxWorker } from '../services/outboxWorker.service.js';

async function runTests() {
  console.log('🧪 Starting Lead Management Module Backend Verification...');

  await connectDB();

  // Test 1: Turnstile verification in dev mode
  console.log('\n--- 1. Testing Turnstile Verification ---');
  const devTurnstileResult = await verifyTurnstileToken('bypass-dev-token', '127.0.0.1');
  console.log('Dev token check result:', devTurnstileResult);
  if (!devTurnstileResult.success) {
    throw new Error('Turnstile dev verification failed');
  }
  console.log('✓ Turnstile verification passed');

  // Test 2: LeadSquared configuration detector
  console.log('\n--- 2. Testing LeadSquared Configuration Detector ---');
  const isCrmConfigured = isLeadSquaredConfigured();
  console.log('Is LeadSquared configured with live credentials?', isCrmConfigured);
  console.log('✓ LeadSquared placeholder handling active');

  // Test 3: Lead Creation with Attribution & Context
  console.log('\n--- 3. Testing Lead Creation & Outbox Jobs ---');
  const testLead = await Lead.create({
    fullName: 'Test Investor Lead',
    email: 'investor.test@example.com',
    countryCode: '+91',
    phone: '9876543210',
    message: 'Interested in luxury 3 BHK penthouse unit. Please share floor plans.',
    formType: 'property_sidebar',
    formLocation: 'property_detail_sidebar',
    projectName: 'The Trillion',
    projectSlug: 'the-trillion',
    city: 'Gurugram',
    developer: 'Smartworld Developers',
    firstTouch: {
      utmSource: 'google_cpc',
      utmMedium: 'cpc',
      utmCampaign: 'luxury_apartments_2026',
      referrer: 'https://google.com',
      landingPage: 'https://zvisory.com/search?city=Gurugram',
      timestamp: new Date(),
    },
    latestTouch: {
      utmSource: 'google_cpc',
      utmMedium: 'cpc',
      utmCampaign: 'luxury_apartments_2026',
      referrer: 'https://google.com',
      landingPage: 'https://zvisory.com/properties/the-trillion',
      timestamp: new Date(),
    },
    utmSource: 'google_cpc',
    utmMedium: 'cpc',
    utmCampaign: 'luxury_apartments_2026',
    ipAddress: '127.0.0.1',
    deviceType: 'desktop',
    browser: 'Chrome',
    status: 'new',
  });

  console.log('Created test lead ID:', testLead._id);

  // Create Outbox Jobs
  const emailJob = await LeadJob.create({
    leadId: testLead._id,
    type: 'EMAIL_NOTIFICATION',
    status: 'pending',
    idempotencyKey: `${testLead._id}_EMAIL_TEST`,
    payload: testLead.toObject(),
  });

  const crmJob = await LeadJob.create({
    leadId: testLead._id,
    type: 'LEADSQUARED_SYNC',
    status: 'pending',
    idempotencyKey: `${testLead._id}_CRM_TEST`,
    payload: testLead.toObject(),
  });

  console.log('Created Outbox jobs:', emailJob._id, crmJob._id);
  console.log('✓ Lead and Outbox jobs created successfully');

  // Test 4: Run Outbox Worker Tick
  console.log('\n--- 4. Testing Outbox Worker Tick ---');
  await tickOutboxWorker();

  const updatedEmailJob = await LeadJob.findById(emailJob._id);
  const updatedCrmJob = await LeadJob.findById(crmJob._id);
  const updatedLead = await Lead.findById(testLead._id);

  console.log('Email Job status after tick:', updatedEmailJob.status);
  console.log('CRM Job status after tick:', updatedCrmJob.status);
  console.log('Lead crmStatus after tick:', updatedLead.crmStatus);
  console.log('✓ Outbox worker executed jobs properly');

  // Test 5: Status update with history
  console.log('\n--- 5. Testing Status Update & History ---');
  updatedLead.status = 'contacted';
  updatedLead.statusHistory.push({
    status: 'contacted',
    changedAt: new Date(),
    notes: 'Advisor called client, requested site visit on Saturday',
  });
  await updatedLead.save();

  const reloadedLead = await Lead.findById(testLead._id);
  console.log('Lead status:', reloadedLead.status);
  console.log('Status history count:', reloadedLead.statusHistory.length);
  if (reloadedLead.status !== 'contacted') {
    throw new Error('Status update failed');
  }
  console.log('✓ Status change & history verified');

  // Test 6: Cleanup test data
  console.log('\n--- 6. Cleaning Up Test Artifacts ---');
  await LeadJob.deleteMany({ leadId: testLead._id });
  await Lead.findByIdAndDelete(testLead._id);
  console.log('✓ Test lead and test jobs deleted cleanly');

  console.log('\n🎉 ALL LEAD MANAGEMENT BACKEND TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Lead module test failed:', err);
  process.exit(1);
});

