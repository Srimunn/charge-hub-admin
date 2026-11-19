FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Source + SQL migrations (drizzle/), applied automatically at startup
COPY . .
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "server.js"]
