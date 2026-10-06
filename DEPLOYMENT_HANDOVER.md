# Notes for deployment

The Task Bot is working locally and is ready for the technical team to take over. The main features are already built: weekly schedules, assignments, notes, breaks, days off, Slack posts, private messages, automatic posting, and acknowledgement buttons.

What is still needed is the production setup.

## Hosting

The bot needs an always-running Node.js service and a PostgreSQL database. It cannot use serverless-only hosting because the Slack connection and daily scheduler need to stay active.

The hosting setup should include:

- One Node.js service running `npm start`
- A managed PostgreSQL database
- HTTPS and the company domain
- Environment variables stored in the hosting platform
- Monitoring for `/api/health`

Railway, a paid always-on Render service, our company infrastructure, or a small VPS should all work.

## Environment variables

Use `.env.example` as the reference. The production environment needs:

- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `SLACK_CHANNEL_ID`

Please use a strong admin password. The current `admin` / `admin` login is only for local testing.

The Slack tokens used during development should be revoked and replaced before launch because they were shared while we were testing.

## Slack setup

Please check the following in the Slack app:

- Socket Mode is enabled
- The app token has `connections:write`
- Interactivity is enabled
- Bot scopes include `chat:write`, `channels:read`, `groups:read`, `users:read`, and `im:write`
- The app is reinstalled after any scope changes
- The bot is invited to the roster channel
- Each team member has the correct Slack member ID in the dashboard

## A few things to improve before launch

The Slack settings page currently saves tokens to the local `.env` file. That works locally, but it may not survive a hosted redeployment. For production, the tokens should either be managed through the hosting platform or stored encrypted in PostgreSQL.

The current login is suitable for one local admin. Before the dashboard is made public, please replace the simple session cookie with a signed session and add rate limiting. Company SSO or access through the company VPN would also be suitable.

The container currently runs `prisma db push` when it starts. It would be better to create proper Prisma migration files and use `prisma migrate deploy` for production releases. Database backups should also be enabled.

Only one copy of the scheduler should run. If the service is scaled to more than one instance later, it will need a locking mechanism to prevent duplicate Slack posts.

## Final test after deployment

1. Sign in with the production admin account.
2. Add a test category and team member.
3. Assign the member, add a note, and set a break.
4. Mark the member off on another day and confirm they cannot be assigned or given a break that day.
5. Use **Push to Slack Now** and check the channel post and private message.
6. Click **Acknowledge** in Slack and confirm the channel message updates without an error.
7. Set an automatic post a few minutes ahead and confirm it posts once.
8. Restart the service and confirm the roster is still there.
9. Redeploy once and confirm the database and secrets stay connected.
10. Check the logs for repeated database or Slack errors.

## Maintenance notes

The project is currently using Next.js 16.3.8 and the production build passes.

The dependency audit still reports an issue through Prisma's configuration tooling. The suggested automatic fix changes the Prisma version, so this should be handled as a tested dependency update instead of applying the forced fix directly.

Next.js also shows a warning about moving from the middleware filename convention to the newer proxy convention. It does not stop the current build, so this can be handled during a future framework update.
