#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Deployment for Gym Tracker..."

# 1. Fix Ownership Trust (prevents the 'dubious ownership' error)
git config --global --add safe.directory /var/www/gym-tracker

# 2. Wipe any local changes and Pull
# This handles the modified package-lock.json automatically
echo "📥 Resetting local changes and pulling from main..."
git reset --hard
git pull origin main

# 3. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 4. Build the project
echo "🏗️  Building Angular application..."
npm run build

# 5. Ensure permissions are correct for Nginx
echo "🔑 Setting permissions..."
sudo chown -R www-data:www-data /var/www/gym-tracker/dist
sudo chmod -R 755 /var/www/gym-tracker/dist

echo "✅ Deployment Successful! Your site is updated."