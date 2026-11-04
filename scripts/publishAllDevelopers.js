import 'dotenv/config';
import connectDB from '../config/dbConnection.js';
import Developer from '../models/developer.model.js';
import mongoose from 'mongoose';

async function publishAllDevelopers() {
  try {
    await connectDB();
    console.log('MongoDB connected successfully');

    // 1. Pre-update counts
    const totalBefore = await Developer.countDocuments();
    const publishedBefore = await Developer.countDocuments({ status: 'published' });
    const nonPublishedBefore = await Developer.countDocuments({ status: { $ne: 'published' } });

    console.log('--- PRE-UPDATE AUDIT ---');
    console.log(`Total Developers: ${totalBefore}`);
    console.log(`Currently Published: ${publishedBefore}`);
    console.log(`Pending Publish (null/draft/archived): ${nonPublishedBefore}`);

    // 2. Targeted update - only modify status field to 'published'
    const updateResult = await Developer.updateMany(
      { status: { $ne: 'published' } },
      { $set: { status: 'published' } }
    );
    console.log(`\nUpdated ${updateResult.modifiedCount} developer records.`);

    // 3. Post-update verification
    const totalAfter = await Developer.countDocuments();
    const publishedAfter = await Developer.countDocuments({ status: 'published' });
    const nonPublishedAfter = await Developer.countDocuments({ status: { $ne: 'published' } });

    console.log('\n--- POST-UPDATE VERIFICATION ---');
    console.log(`Total Developers: ${totalAfter}`);
    console.log(`Published Developers: ${publishedAfter}`);
    console.log(`Non-Published Developers: ${nonPublishedAfter}`);

    if (totalBefore === totalAfter && publishedAfter === totalAfter && nonPublishedAfter === 0) {
      console.log('\nSUCCESS: All developer records successfully published without data loss.');
    } else {
      console.error('\nWARNING: Discrepancy detected during verification!');
    }
  } catch (error) {
    console.error('Error publishing developers:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

publishAllDevelopers();

