# 🏋️ Gym Presence Tracker

A modern, mobile-responsive web application designed to help you track your gym attendance with ease. Visualize your progress, analyze your consistency, and stay motivated on your fitness journey.

![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## ✨ Features

-   **Interactive Calendar**: Intuitive monthly and yearly views to mark and visualize your gym sessions.
-   **Insightful Statistics**: Track your monthly and yearly attendance counts to monitor your consistency.
-   **Data Persistence**: Seamless real-time data storage powered by **Firebase Firestore**.
-   **Responsive Design**: Optimized for a great experience on both mobile devices and desktop screens.
-   **Modern UI**: Clean, user-friendly interface built with Angular's powerful component system.

## 🛠️ Tech Stack

-   **Frontend**: Angular v17+
-   **Language**: TypeScript
-   **Styling**: Modern CSS3 (Responsive Flexbox/Grid)
-   **Database**: Firebase Firestore
-   **State Management**: RxJS

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm (v10 or higher)
-   Angular CLI (`npm install -g @angular/cli`)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/gym-presence-tracker.git
    cd gym-presence-tracker
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

    ### 3. Firebase Setup
    
    1.  Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
    2.  Register a web app in your project settings.
    3.  Create a **Firestore Database** in the project (Start in Test Mode for development).
    
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

### 5. Run the application
    ```bash
    npm start
    ```
    Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.



## 🤖 Credits

This project was **created using antigravity and planning mode with Claude opus 4.5 and Gemini Pro 3**.
