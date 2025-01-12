# Use official Node.js LTS as a base image
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Copy all files into the container
COPY . .

# Set timezone
RUN ln -sf /usr/share/zoneinfo/Asia/Bangkok /etc/localtime

RUN npm i

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["npm", "run", "start:prod"]
