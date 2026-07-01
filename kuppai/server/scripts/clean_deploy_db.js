require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../features/auth/models/User');
const Unit = require('../features/settings/models/Unit');

async function cleanAllForDeploy() {
  if (!process.env.MONGO_URI) {
    console.error('CRITICAL: Missing MONGO_URI in server/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB. Initiating full database wipe...');

  // Get all collections in the database
  const collections = await mongoose.connection.db.collections();

  for (let collection of collections) {
    await collection.deleteMany({});
    console.log(`✓ Cleared 100% records from: ${collection.collectionName}`);
  }

  // Re-seed only essential production Admin account so login works
  await User.create({
    name: 'Production Admin',
    username: 'admin',
    password: 'admin123',
    email: 'admin@kuppai.in',
    role: 'Admin',
    status: 'Active',
    initials: 'PA'
  });
  console.log('\n✓ Created fresh production Admin user (admin / admin123)');

  // Re-seed primary Business Unit
  await Unit.create({
    name: 'Primary Factory Unit',
    location: 'Main Yard',
    code: 'KU-SA',
    color: '#1e3a5f',
    status: 'Active'
  });
  console.log('✓ Created initial production Business Unit (KU-SA)');

  console.log('\n🚀 DATABASE CLEAN COMPLETE! All demo, seed, inventory, and transaction ledgers wiped.');
  process.exit(0);
}

cleanAllForDeploy().catch(err => {
  console.error('Wipe failed:', err);
  process.exit(1);
});
