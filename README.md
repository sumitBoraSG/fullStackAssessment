# Full Stack Doctor Appointment System

A full-stack doctor appointment management system built with **React (Vite)** on the frontend and **Node.js / Express / TypeORM** on the backend.

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** — build tool & dev server
- **Tailwind CSS 4** — styling
- **Lucide React** — icons

### Backend
- **Node.js / Express** with TypeScript
- **TypeORM** — ORM (PostgreSQL)
- **JWT** — authentication (access + refresh tokens)
- **Nodemailer** — email service
- **Winston** — logging
- **Docker** support

## Project Structure

```
fullStackProject/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── api/       # API client functions
│   │   ├── components/# Reusable UI components
│   │   ├── context/   # React context providers
│   │   ├── pages/     # Page components
│   │   └── types/     # TypeScript type definitions
│   └── ...
├── backend/           # Express + TypeORM backend
│   ├── src/
│   │   ├── api/       # Controllers, routes, validators
│   │   ├── config/    # App configuration & secrets
│   │   ├── core/      # Kernel, logger
│   │   ├── database/  # Models, repositories, enums
│   │   ├── middleware/ # Auth, rate limiter, validation
│   │   ├── service/   # Business logic services
│   │   └── types/     # TypeScript type definitions
│   └── ...
└── README.md
```

## Prerequisites

- **Node.js** >= 18.15.0
- **PostgreSQL** database (or use [Neon](https://neon.tech/) for serverless Postgres)
- **npm** package manager

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/fullStackProject.git
cd fullStackProject
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your database URL, JWT secrets, SMTP credentials, etc.

# Run in development mode
npm run watch
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Access the app

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Backend server port (default: 3000) |
| `JWT_SECRET` | Secret key for JWT access tokens |
| `REFRESH_TOKEN_SECRET` | Secret key for JWT refresh tokens |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token expiry (e.g. `7d`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiry (e.g. `15m`) |
| `SMTP_HOST` | Email SMTP host |
| `SMTP_PORT` | Email SMTP port |
| `SMTP_USER` | Email sender address |
| `SMTP_PASSWORD` | Email app password |
| `FRONTEND_URL` | Frontend URL for CORS & email links |

## Available Scripts

### Backend

| Script | Description |
|---|---|
| `npm run watch` | Run in dev mode with hot reload |
| `npm run start` | Build and run |
| `npm run build` | Lint and compile TypeScript |
| `npm run test` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run migrate` | Run database migrations |

### Frontend

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run oxlint |

## Docker (Backend)

```bash
cd backend
docker-compose up -d
```

## License

This project is for educational / personal use.
