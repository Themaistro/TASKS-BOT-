# Slack Task Bot

A lightweight daily roster and scheduling application designed to make team task assignments a breeze. It provides managers with a visual drag-and-drop dashboard to organize daily tasks and breaks, and completely automates publishing the schedule directly to your team's Slack workspace every morning.

## System Architecture

Unlike standard Next.js applications, this project runs two processes simultaneously to bypass the need for a public HTTPS webhook endpoint:
1. **Next.js Web UI:** Handles the drag-and-drop dashboard and REST APIs. Protected by Basic Authentication middleware.
2. **Background Node Worker:** Runs in the background within the same environment. It handles the `node-cron` scheduler for automated morning messages and maintains a persistent WebSocket connection to Slack (via Socket Mode) to instantly listen for button clicks (like the "Acknowledge" button).

## Key Features

- **Drag-and-Drop Dashboard:** A clean, intuitive interface for assigning team members to their daily tasks.
- **Future & Past Planning:** The day-picker at the top of the dashboard allows you to configure repeating daily templates for any day of the week.
- **Automated Slack Roster:** A background worker automatically drops the organized daily schedule right into your team's Slack channel every morning.
- **Private DMs:** Team members get a personalized morning message with their exact tasks and break times so they know exactly what to do.
- **Real-Time Slack Buttons:** When an employee clicks "Acknowledge" on the Slack message, the web dashboard updates instantly.
- **Enterprise-Ready Security:** Built specifically so your DevOps team can safely inject Slack tokens and Admin passwords through Docker Compose without hardcoding any credentials.

---

## ⚙️ Environment Variables

The application requires the following environment variables to function correctly. 

| Variable | Required | Description |
| :--- | :---: | :--- |
| `SLACK_BOT_TOKEN` | **Yes** | Starts with `xoxb-`. Used by the bot to post messages and send DMs. |
| `SLACK_APP_TOKEN` | **Yes** | Starts with `xapp-`. Used to establish the secure Socket Mode WebSocket connection. |
| `SLACK_CHANNEL_ID` | **Yes** | The default Slack Channel ID (e.g., `C0BS4320V96`) where the morning roster is published. |
| `ADMIN_PASSWORD` | **Yes** | Secures the web dashboard behind a Basic Auth login prompt. |
| `DATABASE_URL` | **Yes** | Connection string for PostgreSQL (automatically configured in `docker-compose.yml`). |

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

## 💻 Local Development Setup (PostgreSQL Required)

Because this application uses PostgreSQL for robust data integrity, the easiest way to run it locally is using Docker Compose.

1. **Set up your environment:**
   Copy the example file and drop in your Slack API keys and an Admin Password.
   ```bash
   cp .env.example .env
   ```

2. **Spin up the stack:**
   This command builds the Next.js app and automatically provisions a linked PostgreSQL database container.
   ```bash
   docker-compose up -d --build
   ```

3. **Open the Dashboard:**
   Navigate to [http://localhost:3000](http://localhost:3000). You will be prompted to enter the `ADMIN_PASSWORD` you set in your `.env` file.

---

## 🚀 Production Deployment (IT / DevOps)

This repository includes a production-ready `docker-compose.yml` file that orchestrates the Next.js container alongside a `postgres:15-alpine` database.

1. Ensure the `.env` file is populated with production Slack credentials and a secure `ADMIN_PASSWORD`.
2. Deploy the stack:
   ```bash
   docker-compose up -d
   ```
*(Note: The database tables are automatically migrated via `npx prisma db push` every time the Next.js container starts, ensuring the schema stays in sync.)*
