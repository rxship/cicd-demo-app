FROM node:20-alpine

WORKDIR /app

# Copy dependency files first — this enables Docker to cache npm install
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the source
COPY . .

EXPOSE 3000

CMD ["node", "app.js"]