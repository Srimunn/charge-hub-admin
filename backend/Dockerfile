FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
