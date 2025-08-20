FROM docker.io/node:22-alpine

WORKDIR /app
COPY . .

RUN apk update && apk add openssl
RUN npm install --from-lock-file --legacy-peer-deps

WORKDIR /app/backend
RUN npm install --from-lock-file
RUN npm install -g ts-node

WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000
EXPOSE 9090


CMD ts-node index.ts