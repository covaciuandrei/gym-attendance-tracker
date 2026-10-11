# 🏋️ Gym Attendance Tracker

A modern, mobile-responsive web application designed to help you and your friends track gym attendance with ease. Visualize your progress, analyze your consistency, and stay motivated on your fitness journey.

![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## ✨ Features

-   **Multi-User Support**: Individual accounts with email/password authentication.
-   **Interactive Calendar**: Intuitive monthly and yearly views. Mark gym sessions with specific workout types.
-   **Visual Tracking**: Workout icons (emojis) displayed directly on calendar cells for instant visualization of your training split.
-   **Advanced Statistics**:
    -   **Attendance Mode**: Yearly/Monthly totals with beautiful bar chart breakdowns.
    -   **Workout Mode**: Breakdown of session types (e.g., "Leg Day", "Cardio") per month/year.
    -   **Monthly Detail**: Targeted month picker to analyze exactly what you focused on each month.
-   **Custom Workout Types**: Full CRUD for personalized training categories with custom icons and color-coding.
-   **Secure Authentication**: Robust flow with mandatory email verification, password reset, and protected routes.
-   **High Performance**: Optimized Firestore queries using parallel month loading for snappy dashboard transitions.
-   **Responsive Design**: Mobile-first premium UI that looks stunning on any device.
-   **Data Privacy**: Complete isolation of user data through secure Firestore rules.
-   **Progressive Web App (PWA)**: Installable on mobile and desktop devices with offline support and native-like performance.
-   **Food & Calorie Tracker**: Log meals with a photo and/or a note, let AI estimate calories and macros, and follow your day against a personal calorie target (see the *Food & calorie tracker* section below).

## 🛠️ Tech Stack

-   **Frontend**: Angular v17+
-   **Language**: TypeScript
-   **Styling**: Modern CSS3 (Responsive Flexbox/Grid)
-   **Database**: Firebase Firestore
-   **Authentication**: Firebase Auth
-   **State Management**: RxJS
-   **AI**: Google Gemini, called through a small Azure Functions API (`api/`) that checks the Firebase sign-in
-   **Hosting**: Azure Static Web Apps (frontend + API). nginx, Docker and Netlify also work, without the AI endpoint

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm (v10 or higher)
-   Angular CLI (`npm install -g @angular/cli`)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/gym-attendance-tracker.git
    cd gym-attendance-tracker
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

### 3. Firebase Setup

1.  Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project
2.  Register a web app in your project settings
3.  **Enable Authentication**:
    -   Go to Authentication → Sign-in method
    -   Enable "Email/Password" provider
4.  **Create Firestore Database**:
    -   Go to Firestore Database → Create database
    -   Start in Test Mode for development
5.  **Configure Security Rules** (for production):
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /users/{userId}/{document=**} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
    ```

### 4. Environment Configuration

Create a `.env` file in the root directory based on the example.

**Mac/Linux/Git Bash:**
```bash
cp .env.example .env
```

**Windows (Command Prompt):**
```cmd
copy .env.example .env
```

Fill in your Firebase configuration keys in the `.env` file:
```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 5. Configure Email Templates (Optional)

In Firebase Console → Authentication → Templates, customize:
-   **Email address verification** - Sent when users register
-   **Password reset** - Sent when users request password reset
-   Set the **Action URL** to `https://your-domain.com/auth/action` for deep link handling

### 6. Run the application
```bash
npm start
```
Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## 🐳 Docker Deployment

### Prerequisites

-   [Docker](https://docs.docker.com/get-docker/) (v20+)
-   [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

### Setup & Run

1.  **Ensure your `.env` file is configured** (see [Environment Configuration](#4-environment-configuration) above).
    Docker Compose reads your `.env` file and passes the Firebase values as build arguments — the `.env` file itself is **never copied into the image**.

2.  **Build and start the container**
    ```bash
    docker compose up --build -d
    ```

3.  **Access the app**
    Open [http://localhost:8080](http://localhost:8080) in your browser.

4.  **Health check**
    ```bash
    curl http://localhost:8080/health
    # Returns: healthy
    ```

5.  **Stop the container**
    ```bash
    docker compose down
    ```

### Useful Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start in background |
| `docker compose up --build -d` | Rebuild and start |
| `docker compose logs -f` | Follow container logs |
| `docker compose down` | Stop and remove container |
| `docker exec -it gym-tracker-app sh` | Shell into container |

## 🍽️ Food & calorie tracker

The **Food** tab (second tab of the bottom navigation) is a calorie tracker inside the same account:

-   **Today card and calendar**: a calorie ring with macro bars for today, and a monthly/yearly calendar coloured by how close each day is to your target.
-   **Meals**: any number of meals per day, each with an optional photo, a note, a meal type and a time. *Add again* re-logs a meal you ate before.
-   **AI estimate**: *Estimate with AI* sends the photo and/or note to Gemini and returns the foods, grams, calories and macros, with a confidence level and the assumptions it made. The note wins over the photo ("half of it", "200 g rice"). Every value stays editable, and changing a portion scales its nutrients proportionally.
-   **Goals**: sex, age, height, weight and (optionally) body fat give your maintenance calories (Katch-McArdle when body fat is set, Mifflin-St Jeor otherwise), a daily target for your goal and macro targets.
-   **Stats**: 7/30-day averages, daily calories against the target, macro split and a weight log (**Stats → Nutrition**).
-   **Backup**: export/import (with photos) and *Delete all nutrition data* on the Goals page. Meals logged in the former standalone calorie-tracker app on the same origin are offered for a one-time import.

All of it lives under the signed-in user (see *Database Schema* below), so the Firestore rule from the Firebase setup already protects it; no extra rules are needed.

### AI API (`api/`)

`/api/analyze` and `/api/health` are Azure Functions (Node) deployed next to the frontend on Azure Static Web Apps. The Gemini key stays on the server and never reaches the browser.

-   **Sign-in required**: the app sends the Firebase ID token in an `X-Firebase-Token` header (Azure replaces `Authorization`). The API verifies the RS256 signature against Google's public keys, the project, the expiry and that the email is verified.
-   **Limits**: 30 estimates per 10 minutes and 200 per day for each user; repeated bad tokens are throttled per IP. Models are tried in order (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`, `gemini-3.8-flash`) within a 38 s budget.
-   **Settings** (Azure app settings, or `.env.local` for local development):

| Setting | Required | Purpose |
|---------|----------|---------|
| `GEMINI_API_KEY` | yes | Google AI Studio key (a free-tier key is enough for personal use) |
| `FIREBASE_PROJECT_ID` | yes | Project whose sign-in tokens are accepted |
| `ALLOWED_EMAILS` | no | Comma-separated list; when set, only these accounts can use the AI |
| `GEMINI_MODELS` | no | Comma-separated model list that replaces the default fallback chain |

Anyone can register in the app, so set `ALLOWED_EMAILS` if you do not want other accounts to spend your Gemini quota.

### Local development

```bash
npm run dev:api      # runs the real API code on http://localhost:7071 (needs GEMINI_API_KEY in .env.local)
npm start            # ng serve; /api is proxied to the dev API (proxy.conf.json)
npm run test:api     # API unit tests (node:test, no dependencies)
```

The AI estimate needs the API, so it only works while `npm run dev:api` is running and on the Azure deployment. Logging meals by hand works everywhere.

## ☁️ Azure Static Web Apps deployment

The frontend and the AI API are published together to an Azure Static Web App (the Free plan is enough).

```bash
az login
npm run deploy                 # build, then publish the frontend and the API
npm run deploy -- --settings   # also push GEMINI_API_KEY, FIREBASE_PROJECT_ID (and the optional settings) from .env.local / .env
```

-   The script targets the app `swa-calorie-tracker` in resource group `rg-calorie-tracker`; override them with `SWA_NAME` and `SWA_RESOURCE_GROUP`.
-   The Firebase web config comes from `.env` at build time, exactly like `npm run build`.
-   Routing, the SPA fallback and cache headers live in `src/staticwebapp.config.json`; the API runs on Node 22.
-   Add the site's host name (and any custom domain) to **Firebase Console → Authentication → Settings → Authorized domains**.
-   Verification and password-reset emails use the Firebase action URL, so they work from any host. If you point the template at your own domain instead, the app handles the link at `/auth/action`.
-   The nginx (`deploy.sh`), Docker and Netlify setups serve the frontend only. There is no `/api` there, so the AI estimate is unavailable and meals are logged by hand.

## 📱 App Structure

```
/login          - Sign in page
/register       - Create account page
/forgot-password - Password reset request
/auth/action    - Email verification & password reset handler
/calendar       - Main calendar view (protected)
/stats          - Attendance statistics (protected)
/profile        - User profile & menu
/workout-types  - Manage training categories
/settings       - App settings
/nutrition      - Food home: Today card and calendar (protected)
/nutrition/day/:date           - Meals of one day (protected)
/nutrition/day/:date/entry/:id - Meal editor, `new` adds a meal (protected)
/nutrition/goals - Nutrition goals, backup and import (protected)
/stats/nutrition - Nutrition statistics and weight log (protected)
```

## 🗄️ Database Schema

The app uses a multi-tenant Firestore structure:

```
/users/{userId}
  - email, displayName, createdAt, lastLoginAt, theme, preferences

/users/{userId}/trainingTypes/{typeId}
  - name, color, icon, createdAt

/users/{userId}/attendances/{yearMonth}/days/{date}
  - date, timestamp, trainingTypeId, notes

/users/{userId}/foodEntries/{entryId}
  - date, time, meal, name, note, items[], totals, hasPhoto, source, confidence, aiComment, model

/users/{userId}/foodPhotos/{entryId}
  - data (JPEG data URL, resized to 960 px), updatedAt

/users/{userId}/foodSettings/profile
  - sex, age, height, weight, body fat, activity level, goal, macro split

/users/{userId}/bodyWeights/{date}
  - kg, updatedAt
```

This structure ensures:
-   Complete data isolation between users
-   Efficient month-based queries
-   Scalable cost-effective reads

## 🤖 Credits

This project was **created using antigravity and planning mode with Claude opus 4.5 and Gemini Pro 3**.
