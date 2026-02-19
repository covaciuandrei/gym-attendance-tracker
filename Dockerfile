# Stage 1: Build the Angular app
FROM node:20-alpine AS build

WORKDIR /app

# Declare build arguments for Firebase configuration
ARG FIREBASE_API_KEY
ARG FIREBASE_AUTH_DOMAIN
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_STORAGE_BUCKET
ARG FIREBASE_MESSAGING_SENDER_ID
ARG FIREBASE_APP_ID
ARG FIREBASE_MEASUREMENT_ID

# Make build args available as environment variables for set-envs.js
ENV FIREBASE_API_KEY=$FIREBASE_API_KEY
ENV FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN
ENV FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
ENV FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET
ENV FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID
ENV FIREBASE_APP_ID=$FIREBASE_APP_ID
ENV FIREBASE_MEASUREMENT_ID=$FIREBASE_MEASUREMENT_ID

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the production app (set-envs.js runs automatically via npm run build)
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist/gym-attendance-tracker/browser /usr/share/nginx/html

EXPOSE 80

USER nginx

CMD ["nginx", "-g", "daemon off;"]
