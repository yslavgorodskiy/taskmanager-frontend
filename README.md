# TaskManager Frontend

[![CI](https://github.com/yslavgorodskiy/taskmanager-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/yslavgorodskiy/taskmanager-frontend/actions/workflows/ci.yml)

React + TypeScript + Tailwind CSS frontend for the [TaskManager API](https://github.com/yslavgorodskiy/taskmanager).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v3 |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Forms | React Hook Form |
| HTTP client | Axios |

## Quick Start

```bash
git clone https://github.com/yslavgorodskiy/taskmanager-frontend.git
cd taskmanager-frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:3000**

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |

## Available Scripts

```bash
npm run dev      # Start dev server
npm run build    # TypeScript check + production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Features

- JWT authentication with automatic token refresh
- Tasks — list with filters (status, priority, direction, tags), create/edit/delete
- Directions — group tasks by project or area
- Tags — many-to-many labels with custom colors
- Webhooks — manage endpoints + delivery history
- API Tokens — create, revoke, delete
- Profile — edit name and password
