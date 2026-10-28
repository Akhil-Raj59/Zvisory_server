import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/dbConnection.js';
import City from '../models/city.model.js';
import Project from '../models/project.model.js';
import {
  adminGetCities,
  adminGetCityById,
  adminCreateCity,
  adminUpdateCity,
  adminUpdateCityStatus,
  adminTransferProjects,
  adminDeleteCity,
} from '../controllers/admin.city.controller.js';
import {
  getPublicCities,
  getPublicCityBySlug,
  getPublicCityProjects,
} from '../controllers/city.controller.js';
import { adminGetStats } from '../controllers/admin.project.controllers.js';

// Helper to invoke Express controller and wait for async completion
function invokeController(controller, params = {}, query = {}, body = {}) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseData = null;
    let nextError = null;

    const req = {
      params,
      query,
      body,
      user: { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' },
    };

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        responseData = data;
        resolve({ statusCode, data: responseData, error: nextError });
        return res;
      },
    };

    const next = (err) => {
      nextError = err;
      resolve({ statusCode: err?.statusCode || 500, data: responseData, error: nextError });
    };

    controller(req, res, next);
  });
}

async function runTests() {
  console.log('=== STARTING COMPLETE CITY MODULE VERIFICATION ===\n');

  await connectDB();
  console.log('✓ Connected to MongoDB');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const TEST_CITY_NAME = 'Test Metropolis Alpha';
  const TEST_CITY_SLUG = 'test-metropolis-alpha';
  const TEST_TARGET_NAME = 'Test Destination Beta';
  const TEST_TARGET_SLUG = 'test-destination-beta';
  const TEST_PROJ_1 = 'test-project-alpha-1';
  const TEST_PROJ_2 = 'test-project-alpha-2';

  try {
    // Clean up any stale test artifacts first
    await City.deleteMany({ slug: { $in: [TEST_CITY_SLUG, TEST_TARGET_SLUG] } });
    await Project.deleteMany({ slug: { $in: [TEST_PROJ_1, TEST_PROJ_2] } });

    // ----------------------------------------------------
    // TEST 1: CREATE CITY
    // ----------------------------------------------------
    console.log('\n--- Test 1: City Creation & Validation ---');
    {
      const { statusCode, data, error } = await invokeController(
        adminCreateCity,
        {},
        {},
        {
          name: TEST_CITY_NAME,
          slug: TEST_CITY_SLUG,
          state: 'Haryana',
          country: 'India',
          startingPrice: '₹2.5 Cr*',
          shortDescription: 'A premium test metropolis for verification.',
          description: 'Detailed description for test metropolis showcasing world-class living.',
          highlights: ['Expressway Corridor', 'Metro Phase 3'],
          localities: ['Sector 100', 'Cyber Hub South'],
          gallery: ['https://images.unsplash.com/photo-1?w=800'],
          seo: {
            title: 'Luxury Properties in Test Metropolis Alpha',
            description: 'Top luxury apartments and penthouses in Alpha',
          },
          status: 'published',
          isFeatured: true,
        }
      );

      assert(statusCode === 201, `Status code is 201 Created (got ${statusCode})`);
      assert(!error, 'No validation error on valid creation');
      assert(data?.success === true, 'Response success is true');
      assert(data?.data?.name === TEST_CITY_NAME, 'Created city name matches input');
      assert(data?.data?.slug === TEST_CITY_SLUG, 'Created city slug matches input');
      assert(data?.data?.highlights?.length === 2, 'Highlights parsed into array of 2 elements');
      assert(data?.data?.localities?.length === 2, 'Localities parsed into array of 2 elements');
    }

    // ----------------------------------------------------
    // TEST 2: DUPLICATE NAME & SLUG REJECTION
    // ----------------------------------------------------
    console.log('\n--- Test 2: Duplicate Name & Slug Rejection ---');
    {
      // Case-insensitive duplicate name
      const { statusCode, error } = await invokeController(
        adminCreateCity,
        {},
        {},
        {
          name: 'test metropolis alpha', // lowercase duplicate
          slug: 'different-slug-here',
        }
      );
      assert(error !== null, 'Duplicate name rejected with error');
      assert(statusCode === 409, `Duplicate name returns HTTP 409 Conflict (got ${statusCode})`);

      // Duplicate slug
      const { statusCode: code2, error: err2 } = await invokeController(
        adminCreateCity,
        {},
        {},
        {
          name: 'Completely Unique Name',
          slug: TEST_CITY_SLUG, // duplicate slug
        }
      );
      assert(err2 !== null, 'Duplicate slug rejected with error');
      assert(code2 === 409, `Duplicate slug returns HTTP 409 Conflict (got ${code2})`);
    }

    // ----------------------------------------------------
    // TEST 3: RETRIEVAL BY SLUG AND ID
    // ----------------------------------------------------
    console.log('\n--- Test 3: City Retrieval by Slug & ID ---');
    let createdCityId = null;
    {
      const { statusCode, data } = await invokeController(adminGetCityById, { id: TEST_CITY_SLUG });
      assert(statusCode === 200, 'Admin get by slug returns 200');
      assert(data?.success === true, 'Data success is true');
      assert(data?.data?.name === TEST_CITY_NAME, 'Name matches in retrieved record');
      createdCityId = data?.data?._id?.toString();

      // Retrieve by ObjectId
      const { statusCode: codeId, data: dataId } = await invokeController(adminGetCityById, { id: createdCityId });
      assert(codeId === 200, 'Admin get by ObjectId returns 200');
      assert(dataId?.data?.slug === TEST_CITY_SLUG, 'Slug matches in retrieved record by ID');
    }

    // ----------------------------------------------------
    // TEST 4: UPDATE CITY & STATUS PATCH
    // ----------------------------------------------------
    console.log('\n--- Test 4: City Update & Status Patch ---');
    {
      const { statusCode, data } = await invokeController(
        adminUpdateCity,
        { id: createdCityId },
        {},
        {
          shortDescription: 'Updated short description for verification.',
          startingPrice: '₹3.0 Cr*',
        }
      );
      assert(statusCode === 200, 'Update returns 200');
      assert(data?.data?.startingPrice === '₹3.0 Cr*', 'Starting price was updated');

      // Status patch to draft
      const { statusCode: codeS, data: dataS } = await invokeController(
        adminUpdateCityStatus,
        { id: createdCityId },
        {},
        { status: 'draft' }
      );
      assert(codeS === 200, 'Status update returns 200');
      assert(dataS?.data?.status === 'draft', 'Status was changed to draft');

      // Check public listing excludes draft city
      const { data: pubData } = await invokeController(
        getPublicCities,
        {},
        { search: 'Metropolis Alpha' }
      );
      assert(
        pubData?.data?.every((c) => c.slug !== TEST_CITY_SLUG),
        'Draft city is NOT exposed on public cities endpoint'
      );

      // Restore status to published
      await invokeController(adminUpdateCityStatus, { id: createdCityId }, {}, { status: 'published' });
    }

    // ----------------------------------------------------
    // TEST 5: ASSOCIATE TEST PROJECTS & TEST DELETION REJECTION
    // ----------------------------------------------------
    console.log('\n--- Test 5: Associated Projects & Deletion Protection ---');
    {
      // Create 2 test projects associated with TEST_CITY_NAME
      await Project.create([
        {
          title: 'Test Project Alpha 1',
          slug: TEST_PROJ_1,
          developer: 'Test Developer Ltd',
          city: TEST_CITY_NAME,
          status: 'published',
          startingPrice: '₹2.5 Cr*',
          priceNumeric: 25000000,
        },
        {
          title: 'Test Project Alpha 2',
          slug: TEST_PROJ_2,
          developer: 'Test Developer Ltd',
          city: TEST_CITY_NAME,
          status: 'draft',
          startingPrice: '₹3.5 Cr*',
          priceNumeric: 35000000,
        },
      ]);

      const count = await Project.countDocuments({ city: TEST_CITY_NAME });
      assert(count === 2, '2 test projects created for test city');

      // ATTEMPT TO DELETE CITY - MUST BE REJECTED!
      const { statusCode, data } = await invokeController(adminDeleteCity, { id: createdCityId });

      assert(statusCode === 400, `Deletion REJECTED with HTTP 400 (got ${statusCode})`);
      assert(data?.success === false, 'Deletion response success is false');
      assert(data?.requiresTransfer === true, 'Response requiresTransfer flag is true');
      assert(data?.associatedProjectsCount === 2, 'Reports exactly 2 associated projects');

      // Verify city still exists in DB
      const cityStillExists = await City.findById(createdCityId);
      assert(cityStillExists !== null, 'City document was NOT deleted');

      // Verify projects still exist in DB
      const projectsStillExist = await Project.countDocuments({ city: TEST_CITY_NAME });
      assert(projectsStillExist === 2, 'Projects were NOT deleted');
    }

    // ----------------------------------------------------
    // TEST 6: PROJECT TRANSFER WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- Test 6: Project Transfer Workflow ---');
    let targetCityId = null;
    {
      // Create target city
      const targetCity = await City.create({
        name: TEST_TARGET_NAME,
        slug: TEST_TARGET_SLUG,
        state: 'Karnataka',
        country: 'India',
        status: 'published',
        projectCount: 0,
      });
      targetCityId = targetCity._id.toString();

      // Test self-transfer rejection
      const { statusCode: codeSelf, error: errSelf } = await invokeController(
        adminTransferProjects,
        { id: createdCityId },
        {},
        { targetCityId: createdCityId }
      );
      assert(errSelf !== null, 'Transfer to self is rejected with error');
      assert(codeSelf === 400, `Self-transfer returns 400 (got ${codeSelf})`);

      // Execute valid transfer: Alpha -> Beta
      const { statusCode: codeXfer, data: xferData } = await invokeController(
        adminTransferProjects,
        { id: createdCityId },
        {},
        { targetCityId }
      );

      assert(codeXfer === 200, 'Transfer returns HTTP 200');
      assert(xferData?.success === true, 'Transfer success is true');
      assert(xferData?.data?.transferredCount === 2, 'Reports exactly 2 projects transferred');

      // Verify all affected projects now have target city name
      const projectsUnderTarget = await Project.find({ slug: { $in: [TEST_PROJ_1, TEST_PROJ_2] } });
      assert(projectsUnderTarget.length === 2, 'Both projects found in database');
      assert(
        projectsUnderTarget.every((p) => p.city === TEST_TARGET_NAME),
        `Both projects successfully updated to canonical city "${TEST_TARGET_NAME}"`
      );

      // Verify source city now has 0 projects
      const sourceCount = await Project.countDocuments({ city: TEST_CITY_NAME });
      assert(sourceCount === 0, 'Source city now has 0 remaining projects in DB');
    }

    // ----------------------------------------------------
    // TEST 7: SAFE DELETION AFTER PROJECTS TRANSFERRED
    // ----------------------------------------------------
    console.log('\n--- Test 7: Safe Deletion After Projects Transferred ---');
    {
      const { statusCode, data } = await invokeController(adminDeleteCity, { id: createdCityId });

      assert(statusCode === 200, 'Deletion now SUCCEEDS with HTTP 200');
      assert(data?.success === true, 'Deletion success is true');

      // Verify source city is removed from DB
      const cityAfterDelete = await City.findById(createdCityId);
      assert(cityAfterDelete === null, 'Source city document removed from DB');

      // VERIFY CRITICAL CONSTRAINT: Projects were NOT deleted!
      const projectsAfterCityDelete = await Project.countDocuments({
        slug: { $in: [TEST_PROJ_1, TEST_PROJ_2] },
      });
      assert(projectsAfterCityDelete === 2, 'Associated projects were NOT deleted when city was deleted!');
    }

    // ----------------------------------------------------
    // TEST 8: DASHBOARD STATISTICS VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- Test 8: Dashboard Statistics Database-Derived ---');
    {
      const { statusCode, data } = await invokeController(adminGetStats);
      assert(statusCode === 200, 'adminGetStats returns 200');
      const stats = data?.data;
      assert(typeof stats?.cities === 'number', 'stats.cities is a valid number');
      assert(typeof stats?.cityStats?.total === 'number', 'stats.cityStats.total is a number');
      assert(typeof stats?.cityStats?.published === 'number', 'stats.cityStats.published is a number');
      assert(Array.isArray(stats?.projectsByCity), 'stats.projectsByCity is an array');
      console.log(`  Live stats: Total Cities: ${stats?.cities}, Published: ${stats?.cityStats?.published}`);
    }

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n--- Cleanup ---');
    await City.findByIdAndDelete(targetCityId);
    await Project.deleteMany({ slug: { $in: [TEST_PROJ_1, TEST_PROJ_2] } });
    console.log('✓ All test records safely cleaned up');

    console.log(`\n========================================`);
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions verified)`);
    console.log(`========================================\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n✗ TEST SUITE FAILED:', err);
    // Cleanup even on error
    try {
      await City.deleteMany({ slug: { $in: [TEST_CITY_SLUG, TEST_TARGET_SLUG] } });
      await Project.deleteMany({ slug: { $in: [TEST_PROJ_1, TEST_PROJ_2] } });
    } catch (_) {}
    process.exit(1);
  }
}

runTests();
