# Firebase Setup Guide

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or "Add project")
3. Enter a project name (e.g., "gym-tracker")
4. Disable Google Analytics (optional, not needed for this app)
5. Click **"Create project"**

## Step 2: Create Firestore Database

1. In your Firebase project, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (easier for development)
4. Select your preferred region
5. Click **"Enable"**

## Step 3: Register a Web App

1. In Firebase Console, click the **gear icon** → **"Project settings"**
2. Scroll to **"Your apps"** section
3. Click the **web icon `</>`**
4. Enter app nickname: "gym-tracker-web"
5. Don't enable Firebase Hosting (unless you want to use it)
6. Click **"Register app"**
7. **Copy the Firebase config object** - you'll need it!

## Step 4: Configure Your App

Open `src/environments/environment.ts` and replace the placeholder values:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSy...",           // Your actual apiKey
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
  }
};
```

## Step 5: Restart the Dev Server

After updating the config, restart the dev server:
```bash
npm run start
```

## Verify It Works

Open browser console (F12) - you should see:
- `✅ Firebase initialized successfully` if connected
- `⚠️ Firebase not configured...` if still using placeholders

## Security (For Production)

Before going live, update Firestore rules in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /attendance/{date} {
      allow read, write: if true;  // Anyone can read/write
    }
  }
}
```

> ⚠️ These rules allow anyone to access. For a personal app, this is fine.
> For production with users, add authentication.
