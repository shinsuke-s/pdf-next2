FROM node:20-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run db:push && npm run dev -- --hostname 0.0.0.0 --port 3000"]
