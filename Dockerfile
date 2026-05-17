# Build stage — frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production stage — backend + frontend dist
FROM node:20-alpine
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/src ./src
COPY backend/uploads ./uploads

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./frontend-dist

# Point backend to the correct dist path
ENV NODE_ENV=production
ENV PORT=8000
ENV FRONTEND_DIST_PATH=../frontend-dist

EXPOSE 8000
CMD ["node", "src/index.js"]
