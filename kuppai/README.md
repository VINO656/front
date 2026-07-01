# Kuppai Upscalers ERP — MERN Stack

## Quick Start

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
```
Edit `server/.env`:
```
MONGO_URI=mongodb://localhost:27017/kuppai_erp
JWT_SECRET=change_this_to_a_long_random_string
PORT=5001
```

### 3. Seed demo data
```bash
cd server && node seed.js && cd ..
```
Demo credentials:
- Admin: `admin / admin123`
- Employee: `priya / emp123`

### 4. Run development servers
```bash
npm run dev
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001

### 5. Build for production
```bash
npm run build
npm start
```

The server will also serve the built React app from `client/dist` when it exists.

## Project Structure
```
kuppai/
├── server/              Express + Mongoose API
│   ├── models/          Mongoose schemas
│   ├── routes/          REST endpoints
│   ├── middleware/auth.js  JWT verification
│   ├── index.js         App entry point
│   └── seed.js          Demo data seeder
└── client/              React + Vite frontend
    └── src/
        ├── context/     AppContext (global state)
        ├── components/  Sidebar, Topbar, Modal, Drawer, Toast
        ├── pages/       One file per module
        └── utils/       api.js (axios), fmt.js (formatters)
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Current authenticated user |
| POST | /api/auth/change-password | Change own password |
| GET | /health | Server health check |
| GET/POST/PUT | /api/units | Business units |
| GET/POST/PUT/PATCH | /api/users | User management |
| GET/POST/PUT/DELETE | /api/suppliers?unitId= | Suppliers |
| GET/POST/PUT/DELETE | /api/labours?unitId= | Labours |
| GET/POST/PUT/DELETE | /api/labourcos?unitId= | Labour companies |
| GET/POST/PUT/DELETE | /api/clients?unitId= | Clients |
| GET/POST/PUT/DELETE | /api/purchases?unitId= | Purchases (auto-creates purId) |
| GET/POST/PUT/DELETE | /api/cleaning?unitId= | Cleaning jobs (auto-creates jobId) |
| GET/POST/PUT/DELETE | /api/processing?unitId= | Processing jobs (auto-creates jobId) |
| GET/POST/PUT/DELETE | /api/inventory?unitId=&category= | Inventory batches |
