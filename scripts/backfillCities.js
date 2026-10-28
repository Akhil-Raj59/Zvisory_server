import 'dotenv/config';
import connectDB from '../config/dbConnection.js';
import City from '../models/city.model.js';
import Project from '../models/project.model.js';

async function backfill() {
  await connectDB();
  console.log('Connected to MongoDB');

  // 1. Backfill status: 'published' for any legacy cities missing status
  const updateStatusResult = await City.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'published' } }
  );
  console.log('Updated legacy cities with published status:', updateStatusResult.modifiedCount);

  // 2. Ensure each distinct city in Project has a City document
  const distinctCities = await Project.distinct('city');
  console.log('Distinct cities currently in Project:', distinctCities);

  for (const cityName of distinctCities) {
    if (!cityName) continue;
    const cleanName = cityName.trim();
    const slug = cleanName.toLowerCase().replace(/\s+/g, '-');

    const existing = await City.findOne({
      $or: [
        { name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { slug },
      ],
    });

    const projectCount = await Project.countDocuments({
      city: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });

    if (!existing) {
      console.log(`Registering missing city found in projects: "${cleanName}" (${projectCount} projects)`);
      await City.create({
        name: cleanName,
        slug,
        status: 'published',
        projectCount,
        isFeatured: projectCount > 5,
        startingPrice: '₹1.5 Cr*',
        shortDescription: `Explore luxury residential projects in ${cleanName}.`,
      });
    } else {
      existing.projectCount = projectCount;
      if (!existing.status) existing.status = 'published';
      await existing.save();
    }
  }

  const allCities = await City.find().select('name slug status projectCount isFeatured');
  console.log('\nFinal registered City list in DB:');
  console.table(allCities.map((c) => ({
    name: c.name,
    slug: c.slug,
    status: c.status,
    projects: c.projectCount,
    featured: c.isFeatured,
  })));

  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
