# Use official Node.js LTS (Alpine for smaller size)
FROM node:20-alpine as builder

# Set timezone
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Bangkok /etc/localtime \
    && echo "Asia/Bangkok" > /etc/timezone

# Set the working directory inside the container
WORKDIR /app

# Copy only package files first (to leverage Docker caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# # Generate TypeORM migrations (if applicable)
# RUN npm run migration:generate

# Build the application
RUN npm run build

# # Generate TypeORM migrations (if applicable)
# RUN npm run migration

# ---- Final Stage ----
FROM node:20-alpine

WORKDIR /app

# Copy built files from the builder stage
COPY --from=builder /app /app

# Expose the application port
EXPOSE 3000

# Start the NestJS application
CMD ["npm", "run", "start:prod"]
