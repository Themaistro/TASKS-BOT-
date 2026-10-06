FROM node:20-alpine

# Set working directory
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=400" \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Copy package files and the Prisma schema FIRST
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Run the application without root privileges
RUN chown -R node:node /app
USER node

# Expose the port Next.js runs on
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/health >/dev/null || exit 1

# Start the background server and Next.js app
# We run prisma db push at runtime to ensure the PostgreSQL tables are created
CMD ["sh", "-c", "npx prisma db push && npm start"]
