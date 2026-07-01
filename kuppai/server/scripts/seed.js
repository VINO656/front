require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../features/auth/models/User');
const Unit = require('../features/settings/models/Unit');
const Supplier = require('../features/suppliers/models/Supplier');
const Labour = require('../features/labours/models/Labour');
const Client = require('../features/clients/models/Client');
const Purchase = require('../features/purchases/models/Purchase');
const CleaningJob = require('../features/operations/models/CleaningJob');
const ProcessingJob = require('../features/operations/models/ProcessingJob');
const Inventory = require('../features/inventory/models/Inventory');

async function initClean() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing demo data...');

  await Promise.all([
    Supplier, Labour, Client,
    Purchase, CleaningJob, ProcessingJob, Inventory
  ].map(M => M.deleteMany({})));

  // Ensure default Admin exists
  const adminExists = await User.findOne({ username: 'admin' });
  if (!adminExists) {
    await User.create({
      name: 'Karthik Admin',
      username: 'admin',
      password: 'admin123',
      email: 'admin@kuppai.in',
      role: 'Admin',
      status: 'Active',
      initials: 'KA'
    });
    console.log('Created default Admin user: admin / admin123');
  }

  // Ensure default Unit exists
  const unitExists = await Unit.findOne({ code: 'KU-SA' });
  if (!unitExists) {
    await Unit.create({
      name: 'Salem — Unit A',
      location: 'Salem, TN',
      code: 'KU-SA',
      color: '#1e3a5f',
      status: 'Active'
    });
    console.log('Created default Unit A: Salem');
  }

  console.log('Database initialized cleanly for live data entry (no demo transactions seeded).');
  process.exit(0);
}

initClean().catch(e => { console.error(e); process.exit(1); });
