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

        // Food tracker access (see "Who can use the food tracker" below): one entry per account.
        // The admin is the account with the custom claim `admin: true`.
        function isAdmin() {
          return request.auth != null && request.auth.token.get('admin', false) == true;
        }

        match /nutritionAccess/{uid} {
          allow get: if request.auth != null && (request.auth.uid == uid || isAdmin());
          allow list: if isAdmin();

          // an account may register itself once, switched off
          allow create: if request.auth != null
            && request.auth.uid == uid
            && request.auth.token.email_verified == true
            && request.resource.data.keys().hasOnly(['email', 'displayName', 'enabled', 'createdAt'])
            && request.resource.data.keys().hasAll(['email', 'enabled', 'createdAt'])
            && request.resource.data.enabled == false
            && request.resource.data.email == request.auth.token.email
            && request.resource.data.createdAt == request.time
            && (!('displayName' in request.resource.data)
                || (request.resource.data.displayName is string && request.resource.data.displayName.size() <= 100));

          allow create, update, delete: if isAdmin();
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

The **Food** tab (second tab of the bottom navigation, shown to accounts the admin has switched on) is a calorie tracker inside the same account:

-   **Today card and calendar**: a calorie ring with macro bars for today, and a monthly/yearly calendar coloured by how close each day is to your target.
-   **Meals**: any number of meals per day, each with an optional photo, a note, a meal type and a time. *Add again* re-logs a meal you ate before.
-   **AI estimate**: *Estimate with AI* sends the photo and/or note to Gemini and returns the foods, grams, calories and macros, with a confidence level and the assumptions it made. The note wins over the photo ("half of it", "200 g rice"). Every value stays editable, and changing a portion scales its nutrients proportionally.
-   **Goals**: sex, age, height, weight and (optionally) body fat give your maintenance calories (Katch-McArdle when body fat is set, Mifflin-St Jeor otherwise), a daily target for your goal and macro targets. The numbers update as you type, but your changes only apply once you press **Save**; leaving the page with unsaved changes asks first.
-   **Stats**: 7/30-day averages, daily calories against the target and the macro split (**Stats → Nutrition**).

All of it lives under the signed-in user (see *Database Schema* below), so the Firestore rule from the Firebase setup already protects it. Who may use the food tracker at all is decided separately, by the admin (next section).

### Who can use the food tracker

The food tracker is **off for every account until the admin switches it on**. The admin is the account that carries the Firebase custom claim `admin: true`.

-   **Admin**: **Settings → Food tracker access** lists every account with a switch. Switching an account on or off takes effect in its open app immediately (the Food tab appears or disappears) and in the AI within about 30 seconds. The admin always has access and sees no switch for its own account.
-   **New accounts** register themselves in the list on their first sign-in, switched off. Accounts that existed before the feature were added once with a script, also switched off.
-   **Switched-off accounts** see no Food tab, no Nutrition tab in Stats, no Nutrition goals and no Food link in the calendar, and the Food pages send them back to the calendar. The AI endpoint refuses them (403).
-   **Where it is stored**: `nutritionAccess/{uid}` in Firestore (`email`, `displayName`, `enabled`, `createdAt`, and `updatedAt` / `updatedBy` after the admin changes it). Accounts can read only their own entry and cannot change it; only the admin can (see the rules above).
-   **Making an account the admin** (one time, with the Firebase Admin SDK or the Admin REST API): `setCustomUserClaims(uid, { admin: true })`. The claim is part of the signed ID token, so it cannot be forged; the account sees it after its token refreshes (opening Settings forces that). No email address is written in the code.

The switches decide what the app offers and who can spend the Gemini key. Entries a switched-off account writes inside its own `users/{uid}` space are not blocked by the rules, but nothing in the app lets it get to them and it has no AI.

### AI API (`api/`)

`/api/analyze` and `/api/health` are Azure Functions (Node) deployed next to the frontend on Azure Static Web Apps. The Gemini key stays on the server and never reaches the browser.

-   **Sign-in required**: the app sends the Firebase ID token in an `X-Firebase-Token` header (Azure replaces `Authorization`). The API verifies the RS256 signature against Google's public keys, the project, the expiry and that the email is verified.
-   **Switched on by the admin**: after that, the API reads the account's own `nutritionAccess` entry from Firestore with that same token (so Firestore's rules decide, and no service account is needed). The admin claim skips this step. Answers are remembered for 30 s (on) or 10 s (off), so nobody can turn the API into a read loop. If Firestore cannot be reached the request fails with 503, never open.
-   **Limits**: 30 estimates per 10 minutes and 200 per day for each user, kept in memory per function instance (a guard against runaway loops; the switch above is the real access control); repeated bad tokens are throttled per IP. Models are tried in order (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`, `gemini-3.8-flash`) within a 38 s budget.
-   **Settings** (Azure app settings, or `.env.local` for local development):

| Setting | Required | Purpose |
|---------|----------|---------|
| `GEMINI_API_KEY` | yes | Google AI Studio key (a free-tier key is enough for personal use) |
| `FIREBASE_PROJECT_ID` | yes | Project whose sign-in tokens are accepted |
| `GEMINI_MODELS` | no | Comma-separated model list that replaces the default fallback chain |

### Local development

```bash
npm start            # ng serve plus the local AI API (http://localhost:7071); /api is proxied to it (proxy.conf.json)
npm run dev:api      # the local AI API on its own (needs GEMINI_API_KEY in .env.local)
npm run test:api     # API unit tests (node:test, no dependencies)
```

The AI estimate needs the API: `npm start` runs it next to the dev server, and on the Azure deployment it is always there. If the API is not running, the estimate says the AI service is unavailable. Logging meals by hand works everywhere.

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
/settings/access - Switch the food tracker on or off per account (admin only)
/nutrition      - Food home: Today card and calendar (protected)
/nutrition/day/:date           - Meals of one day (protected)
/nutrition/day/:date/entry/:id - Meal editor, `new` adds a meal (protected)
/nutrition/goals - Nutrition goals (protected)
/stats/nutrition - Nutrition statistics (protected)
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

/nutritionAccess/{userId}
  - email, displayName, enabled, createdAt (updatedAt, updatedBy once the admin changed it)
```

This structure ensures:
-   Complete data isolation between users
-   Efficient month-based queries
-   Scalable cost-effective reads

## 🤖 Credits

This project was **created using antigravity and planning mode with Claude opus 4.5 and Gemini Pro 3**.
