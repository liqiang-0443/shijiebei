FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public

ENV NODE_ENV=production
ENV PORT=4318
ENV DATA_DIR=/data

EXPOSE 4318

CMD ["node", "server.js"]
