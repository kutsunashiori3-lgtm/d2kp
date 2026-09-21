FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Create persistent storage directories
RUN mkdir -p /app/storage/database \
    /app/storage/excel \
    /app/storage/photos \
    /app/storage/embeddings \
    /app/storage/backups \
    /app/storage/logs \
    /app/storage/settings \
    /app/data

# Persistent volumes for database, photos, embeddings, and excel
VOLUME ["/app/storage", "/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_PATH=/app/storage

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

