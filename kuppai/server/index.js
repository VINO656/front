require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI;
const clientDist = path.join(__dirname, '..', 'client', 'dist');

if (!MONGO_URI) {
  console.error('Missing MONGO_URI in server/.env');
  process.exit(1);
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server / curl (no Origin header) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'kuppai-server' });
});

app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'Kuppai ERP API is running' });
});

app.use('/api/auth',       require('./features/auth/auth.routes'));
app.use('/api/units',      require('./features/settings/units.routes'));
app.use('/api/users',      require('./features/users/users.routes'));
app.use('/api/suppliers',  require('./features/suppliers/suppliers.routes'));
app.use('/api/labours',    require('./features/labours/labours.routes'));
app.use('/api/clients',    require('./features/clients/clients.routes'));
app.use('/api/purchases',  require('./features/purchases/purchases.routes'));
app.use('/api/cleaning',   require('./features/operations/cleaning.routes'));
app.use('/api/processing', require('./features/operations/processing.routes'));
app.use('/api/inventory',  require('./features/inventory/inventory.routes'));
app.use('/api/sales',      require('./features/sales/sales.routes'));
app.use('/api/invoices',   require('./features/invoices/invoices.routes'));
app.use('/api/settings',   require('./features/settings/settings.routes'));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  }
  next();
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  }
  next();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log('Server running on port ' + PORT));
  })
  .catch(err => { console.error(err); process.exit(1); });
