# Deployment guide

This guide covers the remaining work needed to run Task Bot on a company domain.

## 1. Choose the hosting setup

Task Bot needs an always-on Node.js service connected to PostgreSQL. Serverless-only hosting is not suitable because the Slack Socket Mode connection and scheduler must remain active.

A suitable setup includes:

- One Node.js service running `npm start`
- A managed PostgreSQL database with backups
- HTTPS and a custom domain
- Environment variables managed by the hosting platform
- Uptime monitoring for `/api/health`

Railway, an always-on Render service, a managed VPS, or existing company infrastructure can support this setup.

## 2. Configure the environment

Use `.env.example` as the reference and add these values through the hosting platform:

- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_CHANNEL_ID`

Use a strong production password and a separate long, random session secret. Do not keep the local `admin` / `admin` credentials.

Revoke the Slack tokens used during development and generate new ones before launch.

## 3. Check the Slack app

- Enable Socket Mode.
- Create an app-level token with `connections:write`.
- Enable Interactivity.
- Add `chat:write`, `channels:read`, `groups:read`, `users:read`, and `im:write` as bot scopes.
- Reinstall the app after changing its scopes.
- Invite the bot to the roster channel.
- Confirm that every team member has the correct Slack member ID in Task Bot.

## 4. Prepare the database

The current Docker command runs `prisma db push` during startup. Before production release, create proper Prisma migrations and switch the startup process to `prisma migrate deploy`.

Enable automated PostgreSQL backups and test that a backup can be restored.

## 5. Complete the security work

The current login supports one administrator and uses a signed session cookie. Before exposing the dashboard publicly, add rate limiting to the login endpoint. Company SSO, a VPN, or an identity-aware proxy can provide another layer of protection.

Review the middleware rules and confirm that every administrative API endpoint requires authentication.

The Slack settings page currently writes credentials to the local `.env` file. This is useful during local testing, but local container files may be replaced during deployment. In production, either manage Slack credentials through the hosting platform or store encrypted values in PostgreSQL using a separate encryption key.

## 6. Run the service

Build the included Docker image and start one application instance. Confirm that the hosting service does not sleep when inactive.

Only one scheduler should run. If the application is scaled to multiple instances later, add a distributed lock to prevent duplicate Slack posts.

## 7. Connect the domain

Point the company domain or subdomain to the service and enable HTTPS. Confirm that secure cookies work correctly through the production domain.

## 8. Test the complete workflow

1. Sign in using the production admin account.
2. Add a test category and team member.
3. Assign the member, add a note, and set a break.
4. Mark the member off on another day and confirm they cannot be assigned or given a break.
5. Select **Push to Slack Now** and check the channel post and private message.
6. Select **Acknowledge** in Slack and confirm the channel message updates without an error.
7. Schedule a post a few minutes ahead and confirm it posts once.
8. Restart the service and confirm the roster remains available.
9. Redeploy the service and confirm that the database and secrets remain connected.
10. Review the logs for recurring Slack or database errors.

## Maintenance notes

The production build currently passes on Next.js 16.3.8.

The dependency audit reports an advisory through Prisma's configuration tooling. Its automatic fix changes the Prisma version, so the upgrade should be tested before it is applied.
