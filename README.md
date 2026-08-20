# Slack Task Bot

An automated scheduling and daily roster management system integrated directly with Slack via Socket Mode. It allows managers to visually drag and drop employees into tasks, set break schedules, and automatically publish a clean daily roster to Slack every morning.

## Features

- **Visual Roster Dashboard:** Next.js drag-and-drop interface to assign employees to daily tasks.
- **Per-Day Break Scheduling:** Assign precise 5-minute increment breaks for employees based on the day of the week.
- **Automated Slack Posting:** Background node-cron scheduler posts the roster every morning automatically.
- **Individual Slack DMs:** Employees receive a private Direct Message with their specific task and break time.
- **Socket Mode Integration:** Acknowledge buttons on the Slack messages update the web dashboard in real-time without requiring a public HTTPS endpoint.
- **In-App Slack Configuration:** Safely update Slack API tokens directly from the web UI.

## Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, @dnd-kit
- **Backend:** Node.js, background worker, Next.js API Routes
- **Database:** Prisma ORM, SQLite (easily swappable to PostgreSQL)
- **Slack:** @slack/socket-mode, @slack/web-api

## Local Development Setup

1. **Install dependencies:**
   \\\ash
   npm install
   \\\

2. **Environment Variables:**
   Copy the example environment file and fill in your Slack credentials.
   \\\ash
   cp .env.example .env
   \\\

3. **Initialize the Database:**
   Generate the Prisma client and push the schema to create the SQLite file.
   \\\ash
   npx prisma generate
   npx prisma db push
   \\\

4. **Start the Application:**
   This starts both the Next.js dashboard and the background Slack Socket worker.
   \\\ash
   npm run dev
   \\\

5. **Open Dashboard:**
   Navigate to http://localhost:3000

## Production Deployment

For corporate deployments (AWS, Azure, GCP, or internal servers), a standard Dockerfile is included.

### Using Docker
\\\ash
docker build -t slack-task-bot .
docker run -p 3000:3000 -v /path/to/persistent/data:/app/prisma --env-file .env slack-task-bot
\\\
*(Note: Ensure /app/prisma is mounted as a persistent volume if continuing to use SQLite to prevent data loss on container restarts. Alternatively, change provider = "sqlite" to "postgresql" in schema.prisma and point DATABASE_URL to a managed DB).*

### Slack App Requirements
Ensure the Slack App in your workspace has the following configurations:
- **Socket Mode:** Enabled
- **Scopes:** chat:write, channels:read, im:write, users:read
- **Events Subscriptions:** Enabled (Listening for interactive actions)
