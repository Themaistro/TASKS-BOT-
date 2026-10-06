# Task Bot — Deployment Handover

## Current status

The application is feature-complete for local team testing and passes a production build. The dashboard, roster management, notes, days off, breaks, manual Slack posting, scheduled posting, DMs, and acknowledgement handling have been implemented.

It still requires production infrastructure and security work before it is exposed on a company domain.

## Recommended deployment architecture

- One always-on Node.js service running `npm start`
- Managed PostgreSQL database with backups
- HTTPS custom domain behind the hosting provider or reverse proxy
- Provider-managed environment variables/secrets
- Health check: `GET /api/health`

Railway, Render with an always-on paid service, a company Kubernetes environment, or a small managed VPS can run this architecture. Serverless-only hosting is not suitable because `server.js` maintains a cron scheduler and Slack Socket Mode WebSocket connection.

## Deployment procedure

1. Provision PostgreSQL and obtain `DATABASE_URL`.
2. Add all variables from `.env.example` to the hosting provider's secret manager.
3. Set a unique, strong `ADMIN_PASSWORD`; do not deploy with `admin` / `admin`.
4. Rotate the Slack bot and app tokens before launch, then add the new values as secrets.
5. Build the container using the included `Dockerfile`.
6. Start the service. The container currently runs `npx prisma db push && npm start`.
7. Configure HTTPS and the company domain.
8. Confirm that the service remains continuously running and does not sleep.
9. Invite the Slack bot to the roster channel.
10. Complete the acceptance checks below.

## Important production work

### 1. Slack settings persistence

The current Settings screen writes Slack credentials to the local `.env` file. This works locally but is not reliable on hosts with immutable or ephemeral filesystems. For production, choose one of these approaches:

- Preferred: manage Slack tokens only in the hosting provider's secret manager and make the token fields read-only/hidden in the dashboard.
- Alternative: store encrypted credentials in PostgreSQL using a separate encryption key supplied by the host.

Do not store unencrypted production Slack tokens in normal database columns.

### 2. Authentication hardening

The current application uses a simple single-admin cookie intended for local testing. Before public exposure, replace it with a signed server-side session and rate-limit login attempts. The tech team may also place the application behind company SSO, VPN, or an identity-aware proxy.

Review the middleware matcher as part of this work and ensure every administrative API route requires authentication.

### 3. Database migrations and backups

The Docker image currently uses `prisma db push` on startup. For controlled production releases, create and commit Prisma migrations and use `prisma migrate deploy`. Enable automated database backups and test restoration.

### 4. Operational reliability

- Run exactly one scheduler instance, or add a distributed lock if multiple replicas are required.
- Add structured logs and provider alerts for failed Slack posts or Socket Mode disconnects.
- Add a restart policy and uptime monitoring for `/api/health`.
- Confirm the configured timezone and daylight-saving behavior.

## Slack app checklist

- Socket Mode: enabled
- App token scope: `connections:write`
- Interactivity: enabled
- Bot scopes: `chat:write`, `channels:read`, `groups:read`, `users:read`, `im:write`
- App reinstalled after scope changes
- Bot invited to the target public or private channel
- Team members entered with correct Slack member IDs

## Acceptance test

1. Sign in using the production admin credentials.
2. Create a test category and test team member.
3. Assign the member, add a note, configure a break, and save.
4. Mark the member off on another day and verify they cannot be assigned or given a break that day.
5. Select **Push to Slack Now** and verify the channel roster and personal DM.
6. Select **Acknowledge** in Slack and verify the message updates without an error indicator.
7. Configure an automated post a few minutes ahead and verify it posts once.
8. Restart the service and verify all database-backed roster data remains.
9. Redeploy the service and verify secrets and database data remain available.
10. Review logs to confirm there are no recurring database or Slack connection errors.

## Files that must never be committed

- `.env` and other real environment files
- `*.db` local databases
- Slack tokens, passwords, or OAuth secrets
- PostgreSQL backups containing company data

## Known build note

Next.js reports that the middleware filename convention is deprecated in favor of the newer proxy convention. The current build succeeds; this warning can be handled during a future framework maintenance update.

The final production audit no longer reports the critical Next.js advisory after upgrading to Next.js 16.3.8. It still reports a high-severity `deepmerge-ts` advisory through Prisma's configuration tooling. The automated recommendation is a breaking Prisma version change, so the deployment team should review and test a Prisma upgrade separately before launch.
