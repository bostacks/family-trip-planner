FROM node:20-slim

WORKDIR /app

COPY package.json ./
# No runtime dependencies — uses Node built-ins only.

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
