# Adaptive AI Billing Platform ⚡

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?style=flat-square&logo=react)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)

An intelligent, multi-tenant billing, invoicing, and revenue management platform designed for SaaS, agencies, and enterprise applications. Powered by TypeScript monorepo architecture, adaptive billing logic, and AI anomaly detection.

---

## 🌟 Key Features

- **🏢 Multi-Tenant Architecture**: Isolated workspaces, tenant-scoped data models, role-based access control (RBAC), and per-tenant branding.
- **🤖 Adaptive AI Orchestration**: Dynamic anomaly detection, payment failure forecasting, automated invoice parsing, and revenue trend analysis.
- **🧾 Flexible Billing & Invoice Engines**:
  - Tiered, usage-based, subscription, and one-off invoicing calculators.
  - Automated tax, discount, credit note, and multi-currency calculations.
- **⚡ Modern Frontend Dashboard**:
  - Built with React 19, Vite, and Lucide icons.
  - Interactive invoice builder, customer ledger, and revenue analytics charts.
- **🔒 Enterprise Security**:
  - JWT authentication with secure HTTP cookies and password hashing via Bcrypt.
  - Strict input validation powered by Zod schemas.
- **🐳 Container Ready**: Out-of-the-box `docker-compose.yml` for MongoDB, backend services, and cache orchestration.

---

## 🏗️ Architecture & Project Structure

```
adaptive-ai-billing-platform/
├── backend/                  # Express + TypeScript API server
│   ├── src/
│   │   ├── billing-engine/   # Pricing rules, calculators, and invoice generators
│   │   ├── controllers/      # Route controllers (auth, invoices, tenants, payments)
│   │   ├── middleware/       # JWT auth, tenant resolver, rate limiting
│   │   ├── models/           # Mongoose schemas (Tenant, User, Invoice, Customer)
│   │   ├── seed.ts           # Database seeding script
│   │   └── server.ts         # Express server entrypoint
│   └── tsconfig.json
├── frontend/                 # React 19 + Vite frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components & layouts
│   │   ├── pages/            # Dashboard, Invoices, Customers, Settings
│   │   └── App.tsx
│   └── vite.config.ts
├── shared/                   # Shared types, Zod schemas, and utility constants
├── Doc/                      # System documentation, design docs & specifications
├── docker-compose.yml        # Multi-container orchestration (MongoDB, Backend)
└── package.json              # Root workspace management
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20+` or `v22+`
- **npm** or **pnpm**
- **MongoDB**: Local instance running on port `27017` or MongoDB Atlas URI

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ShibilAhamed701212/adaptive-ai-billing-platform.git
cd adaptive-ai-billing-platform
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root or `backend/`:
```bash
cp .env.example .env
```

Ensure variables are set:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/adaptive_billing
JWT_SECRET=your_super_secret_jwt_key_here
```

### 3. Seed Demo Data (Optional)
```bash
npm run seed
```

### 4. Run Development Servers
Run backend and frontend concurrently:
```bash
npm run dev
```
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`

---

## 🐳 Docker Deployment

Run the complete stack with Docker Compose:
```bash
docker-compose up --build
```

---

## 🧪 Testing & Quality

Run test suites across workspaces:
```bash
npm run test
```

---

## 📄 License
ISC License. Built by [Shibil Ahamed](https://github.com/ShibilAhamed701212).
