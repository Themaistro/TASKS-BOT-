FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and the Prisma schema FIRST
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port Next.js runs on
EXPOSE 3000

# Set environment variables for the runtime container
ENV DATABASE_URL=file:./dev.db

# Start the background server and Next.js app
CMD ["npm", "start"]
