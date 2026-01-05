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

## 🛠️ Tech Stack

-   **Frontend**: Angular v17+
-   **Language**: TypeScript
-   **Styling**: Modern CSS3 (Responsive Flexbox/Grid)
-   **Database**: Firebase Firestore
-   **Authentication**: Firebase Auth
-   **State Management**: RxJS

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
```

## 🗄️ Database Schema

The app uses a multi-tenant Firestore structure:

```
/users/{userId}
  - email, displayName, createdAt, preferences

/users/{userId}/trainingTypes/{typeId}
  - name, color, icon, createdAt

/users/{userId}/attendances/{yearMonth}/days/{date}
  - date, timestamp, trainingTypeId, notes
```

This structure ensures:
-   Complete data isolation between users
-   Efficient month-based queries
-   Scalable cost-effective reads

## 🤖 Credits

This project was **created using antigravity and planning mode with Claude opus 4.5 and Gemini Pro 3**.
