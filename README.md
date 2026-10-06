# Task Bot

Task Bot is a Next.js dashboard for building weekly team rosters and publishing them to Slack. It supports Sunday–Saturday schedules, drag-and-drop assignments, task notes, days off, break schedules, scheduled posting, direct messages, and Slack acknowledgement buttons.

## Stack

- Next.js 16 / React 19
- Custom Node.js server (`server.js`)
- PostgreSQL with Prisma
- Slack Web API and Socket Mode
- Docker and Docker Compose

The custom server runs the web application, cron scheduler, and persistent Slack Socket Mode connection in one always-on process. Do not deploy this project as a serverless-only application.

## Local setup

1. Copy `.env.example` to `.env` and set the required values.
2. Start PostgreSQL and the application:

   ```bash
   docker compose up --build
   ```

3. Open `http://localhost:3000`.

Stopping Docker does not delete the database. Deleting the `pgdata` volume does.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_USERNAME` | Dashboard username |
| `ADMIN_PASSWORD` | Dashboard password |
| `SLACK_BOT_TOKEN` | Slack bot token beginning with `xoxb-` |
| `SLACK_APP_TOKEN` | Slack app token beginning with `xapp-` |
| `SLACK_CHANNEL_ID` | Channel where the roster is posted |

The application defaults to `admin` / `admin` when admin variables are absent. That fallback is for local testing only and must not be used on a public deployment.

## Slack configuration

Configure the Slack app with:

- Socket Mode enabled
- An app-level token with `connections:write`
- Interactivity enabled for acknowledgement buttons
- Bot scopes: `chat:write`, `channels:read`, `groups:read`, `users:read`, and `im:write`
- The bot invited to the target channel

Reinstall the Slack app after changing OAuth scopes.

## Verification

```bash
npm ci
npm run build
```

For production deployment instructions, security notes, and acceptance checks, see [DEPLOYMENT_HANDOVER.md](DEPLOYMENT_HANDOVER.md).

## Secret handling

Never commit `.env`, database files, Slack tokens, or production credentials. Tokens previously shared outside the deployment secret manager should be revoked and regenerated before launch.
