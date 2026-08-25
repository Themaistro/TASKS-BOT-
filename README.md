# Slack Task Bot

A lightweight daily roster and scheduling application designed to make team task assignments a breeze. It provides managers with a visual drag-and-drop dashboard to organize daily tasks and breaks, and completely automates publishing the schedule directly to your team's Slack workspace every morning.

## System Architecture

Unlike standard Next.js applications, this project runs two processes simultaneously to bypass the need for a public HTTPS webhook endpoint:
1. **Next.js Web UI:** Handles the drag-and-drop dashboard and REST APIs.
2. **Background Node Worker:** Runs in the background within the same environment. It handles the `node-cron` scheduler for automated morning messages and maintains a persistent WebSocket connection to Slack (via Socket Mode) to instantly listen for button clicks (like the "Acknowledge" button).

## Key Features

- **Drag-and-Drop Dashboard:** A clean, intuitive interface for assigning team members to their daily tasks.
- **Flexible Break Scheduling:** Set precise 5-minute break increments for everyone, customizable by the day of the week.
- **Automated Slack Roster:** A background worker automatically drops the organized daily schedule right into your team's Slack channel every morning.
- **Private DMs:** Team members get a personalized morning message with their exact tasks and break times so they know exactly what to do.
- **Real-Time Slack Buttons:** When an employee clicks "Acknowledge" on the Slack message, the web dashboard updates instantly.
- **Enterprise-Ready Security:** Built specifically so your DevOps team can safely inject Slack tokens through Docker without hardcoding any passwords.

---

## ⚙️ Environment Variables

The application requires the following environment variables to function correctly. 

| Variable | Required | Description |
| :--- | :---: | :--- |
| `SLACK_BOT_TOKEN` | **Yes** | Starts with `xoxb-`. Used by the bot to post messages and send DMs. |
| `SLACK_APP_TOKEN` | **Yes** | Starts with `xapp-`. Used to establish the secure Socket Mode WebSocket connection. |
| `SLACK_CHANNEL_ID` | **Yes** | The default Slack Channel ID (e.g., `C0BS4320V96`) where the morning roster is published. |
| `DATABASE_URL` | No | Defaults to `file:./dev.db` for SQLite. Must be updated if migrating to PostgreSQL. |

---

## 🛠️ Slack App Configuration

Before deploying, ensure your Slack App in the [Slack Developer Portal](https://api.slack.com/apps) is configured precisely with these settings:

1. **Socket Mode:** Navigate to `Settings > Socket Mode` and toggle it **On**. (This generates your `SLACK_APP_TOKEN`).
2. **OAuth & Permissions:** Add the following Bot Token Scopes:
   - `chat:write` (To post the roster)
   - `channels:read` (To find the target channel)
   - `im:write` (To send private DMs to employees)
   - `users:read` (To resolve Slack User IDs)
3. **Event Subscriptions:** Toggle **On**. No Request URL is needed because Socket Mode handles the routing.
4. **Interactivity & Shortcuts:** Toggle **On**. This allows the bot to listen to the "Acknowledge" button clicks on the roster.

---

## 💻 Local Development Setup

Want to spin this up on your own machine to test it out?

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your environment:**
   Copy the example file and drop in your Slack API keys.
   ```bash
   cp .env.example .env
   ```

3. **Prep the database:**
   This will generate the Prisma client and create your local SQLite database file.
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start the application:**
   This boots up both the web dashboard and the background worker that listens to Slack.
   ```bash
   npm run dev
   ```
   *Then simply navigate to [http://localhost:3000](http://localhost:3000) in your browser!*

---

## 🚀 Production Deployment (Docker)

If you are handing this project off to an IT or DevOps team, the repository includes a multi-stage `Dockerfile` optimized for production environments (AWS, Azure, GCP).

### Step 1: Build the Image
To build the Docker image locally, run this in your terminal:
```bash
docker build -t slack-task-bot .
```

### Step 2: Run the Container
Because Docker containers start completely blank, the background worker requires the Slack tokens to be passed in at boot time so it can establish the WebSocket connection. 

Run this command to automatically securely inject the required tokens directly from your local `.env` file:
```bash
docker run -p 3000:3000 --env-file .env slack-task-bot
```

### 🗄️ Database Migration Notes (For DevOps)
Out of the box, this application uses **SQLite** for zero-config local development. If you are deploying this to a clustered production environment, you should swap to PostgreSQL to avoid database locking issues:
1. Open `prisma/schema.prisma`.
2. Change `provider = "sqlite"` to `provider = "postgresql"`.
3. Provide a valid Postgres connection string in the `DATABASE_URL` environment variable.
4. Run `npx prisma db push` against the new database.
