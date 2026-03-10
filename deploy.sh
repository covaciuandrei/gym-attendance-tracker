#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Deployment for Gym Tracker..."

# 1. Pull the latest code from GitHub
echo "📥 Pulling latest changes from main..."
git pull origin main

# 2. Install dependencies (if any new ones were added)
echo "📦 Installing dependencies..."
npm install

# 3. Build the project
# This runs 'npm run config' (to set envs) then 'ng build'
echo "🏗️  Building Angular application..."
npm run build

# 4. Ensure permissions are correct for Nginx
# Even if the build creates new files, this keeps them readable
echo "🔑 Setting permissions..."
sudo chown -R www-data:www-data /var/www/gym-tracker/dist
sudo chmod -R 755 /var/www/gym-tracker/dist

echo "✅ Deployment Successful! Your site is updated."