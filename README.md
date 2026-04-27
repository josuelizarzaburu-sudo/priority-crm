# Priority CRM

AI-powered omnichannel CRM with Kanban pipeline, 360° contacts, WhatsApp/Email/VoIP communications, and Claude AI integration.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Cache / Queues | Redis + Bull |
| AI | Anthropic Claude API |
| Realtime | Socket.io |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
priority-crm/
├── apps/
│   ├── web/                  # Next.js 14 frontend
│   │   └── src/
│   │       ├── app/          # App Router pages
│   │       ├── components/   # React components
│   │       ├── lib/          # Utilities, auth, API client
│   │       └── store/        # Zustand stores
│   └── api/                  # NestJS backend
│       └── src/
│           └── modules/
│               ├── auth/           # JWT authentication
│               ├── users/          # User management
│               ├── contacts/       # 360° contact management
│               ├── pipeline/       # Kanban pipeline + WebSocket
│               ├── communications/ # WhatsApp, Email, VoIP
│               ├── ai/             # Claude AI integration
│               ├── automations/    # Workflow automations
│               └── webhooks/       # Inbound webhook handlers
├── packages/
│   ├── database/             # Prisma schema + PrismaService
│   ├── shared/               # Shared TypeScript types & utils
│   └── ui/                   # Shared React components
├── docker/                   # Docker & docker-compose files
└── .github/workflows/        # CI/CD pipelines
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure (Postgres, Redis, Mailhog)

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

### 3. Configure environment

```bash
cp .env.example .env
# Fill in your values (JWT_SECRET, ANTHROPIC_API_KEY, etc.)
```

### 4. Run database migrations & seed

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Start development servers

```bash
pnpm dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Swagger docs: http://localhost:3001/docs
- Mailhog: http://localhost:8025

**Default seed credentials:** `admin@acme.com` / `password123`

## Key Features

### Pipeline Kanban
- Drag-and-drop deal management with real-time updates via WebSocket
- Configurable stages with win probability
- Deal value tracking and forecasting

### Contacts 360°
- Unified contact profiles with full interaction history
- Timeline view: activities, messages, deals
- Tag system and custom fields

### Omnichannel Communications
- **WhatsApp**: Meta Cloud API or Twilio
- **Email**: SMTP / SendGrid / Resend
- **VoIP**: Twilio Voice
- Unified inbox with real-time message sync

### AI Assistant (Claude)
- Contact summaries
- Next-action suggestions for deals
- AI message drafting
- Streaming chat interface

### Automations
- Event-driven trigger system
- Actions: send WhatsApp/email, move deal, create task, notify user
- Background processing via Bull queues

## Development Commands

```bash
pnpm dev              # Start all apps in watch mode
pnpm build            # Build all apps
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript check all packages
pnpm db:generate      # Regenerate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed database
```

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

## License

Private — All rights reserved.
