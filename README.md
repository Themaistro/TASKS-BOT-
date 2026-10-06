# Task Bot

Task Bot is a simple weekly scheduling tool for teams that work in Slack. It gives managers one place to prepare the roster, assign tasks, add notes and breaks, and publish the final schedule to the team.

The project is designed for a single administrator and one Slack workspace.

## Features

- Weekly scheduling from Sunday through Saturday
- Drag-and-drop task assignments
- Notes for individual assignments
- Break schedules for each team member
- Configurable days off and active workdays
- Manual or scheduled Slack posting
- Personal Slack messages with each member's tasks and break time
- Acknowledgement buttons in the channel roster
- Manual Slack configuration from the dashboard

## Technology

- Next.js 16 and React 19
- PostgreSQL and Prisma
- Slack Web API and Socket Mode
- Node.js scheduler
- Docker and Docker Compose

The application uses a custom Node.js server. The website, scheduled posting, and Slack Socket Mode connection all run in the same process, so the production service needs to remain online continuously.

## Run locally

### Requirements

- Node.js 20.9 or newer
- Docker Desktop
- A Slack app configured for Socket Mode

### Setup

1. Download or clone the repository:

   ```bash
   git clone https://github.com/Themaistro/TASKS-BOT-.git
   cd TASKS-BOT-
   ```

2. Copy `.env.example` to `.env`.

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS or Linux:

   ```bash
   cp .env.example .env
   ```

3. Open `.env`, choose the dashboard credentials, and add the Slack settings. Replace `SESSION_SECRET` with a long random value.
4. Start the application and database:

   ```bash
   docker compose up --build
   ```

5. Wait until both containers are healthy, then open [http://localhost:3000](http://localhost:3000).

If no `.env` file is provided, Docker Compose falls back to `admin` / `admin` and a development-only session secret. These defaults are for local testing only.

Docker stores PostgreSQL data in the `pgdata` volume. Stopping Docker will not remove the data, but deleting that volume will.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_PORT` | Local Docker port; defaults to `3000` |
| `ADMIN_USERNAME` | Dashboard username |
| `ADMIN_PASSWORD` | Dashboard password |
| `SESSION_SECRET` | Secret used to sign login sessions |
| `SLACK_BOT_TOKEN` | Bot token used to post messages and send DMs |
| `SLACK_APP_TOKEN` | App-level token used by Socket Mode |
| `SLACK_CHANNEL_ID` | Default channel for the daily roster |

Optional Slack OAuth variables are listed in `.env.example`, but the current dashboard uses manual token configuration.

## Slack app requirements

The Slack app must have:

- Socket Mode enabled
- An app-level token with `connections:write`
- Interactivity enabled
- Bot scopes: `chat:write`, `channels:read`, `groups:read`, `users:read`, and `im:write`
- Access to the channel where the roster will be posted

If the bot scopes change, reinstall the Slack app before testing again.

## Build check

```bash
npm ci
npm run build
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for production setup, security work, and the final test checklist.

## Useful Docker commands

```bash
# View container status
docker compose ps

# Follow application logs
docker compose logs -f app

# Stop the project without deleting its data
docker compose down
```

Avoid `docker compose down --volumes` unless you intentionally want to delete the local database.

## Security

Do not commit `.env`, Slack tokens, passwords, or database files. Create new Slack tokens before production deployment because the development credentials were exposed during testing.
