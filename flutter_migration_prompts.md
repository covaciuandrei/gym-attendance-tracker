# AI Prompt Sequence: Gym Tracker Flutter Migration (Logic-First & TDD)

> **User Instructions for File Setup & Git Workflow**: 
> 1. Clone your `Flutter-starting-project` repository and rename it to `gym-tracker`.
> 2. Initialize a fresh git repository if needed (`rm -rf .git && git init`).
> 3. Copy the `src` folder from your **Angular Gym Presence Tracker Project** into this `gym-tracker` folder (to provide the actual app logic, UI, and business requirements).
> 4. Copy the `lib` folder from your **Teamlyst Project** into a new subfolder called `teamlyst_reference` within the `gym-tracker` folder (to provide reference for complex core features).
> 5. Create your initial commit: `git add . && git commit -m "chore: initial commit with starter template, angular reference, and teamlyst reference"`
> 6. Provide this entire `gym-tracker` folder to Sonnet 4.6 *first*.
> 7. Then, begin with the prompts below, sending them **one by one**.
> 
> **Important Rule for the AI:** After every single phase, you must instruct me to run the tests, and give me the exact `git checkout -b`, `git add`, and `git commit` commands to save that phase's work as a professional, atomic commit. I will use Pull Requests to merge each phase into `main` to build a professional commit history for my CV.

---

## Phase 0: Training & Context Analysis

> **Prompt 0: Analyze My Architecture & Original App**
> 
> You are an Expert Senior Flutter Architect. Your ultimate goal is to migrate my existing Angular web application (`gym-presence-tracker`) into a pixel-perfect Flutter mobile app. 
> 
> I have provided a folder containing a starter Flutter project (`Flutter-starting-project`) into which I've copied the `src` folder of my Angular app and the `lib` folder of my `teamlyst` app.
> 1. The source code for my existing Angular app (`src`). This is the app you are rebuilding in Flutter. Analyze its features, Firebase structure, and UI deeply.
> 2. The codebase of the starter Flutter app. This app already has `pubspec.yaml`, `get_it`, `auto_route`, and `BaseCubit` set up, and dictates *exactly* how I write Flutter code.
> 3. The `teamlyst_reference` folder. I have included this because many of the core features and more complex implementations are built very well here. Use this as a reference guide if you need inspiration for implementing core features beyond the basic boilerplate.
> 
> **Your task for this prompt:**
> 1. Analyze the starter app's routing setup (`auto_route`), dependency injection setup (`get_it` and `injectable`), and State Management approach (`flutter_bloc`, `BaseCubit`, `BaseState`).
> 2. Deeply analyze the `teamlyst_reference` codebase. I want you to understand how I implemented core features, complex UI patterns, dialogs, bottom sheets, and advanced state management interactions in a production app. Pay close attention to how features are structured and connected.
> 3. Understand that the new Flutter app you are building MUST mimic the features from the Angular app, using the clean architectural foundation of the starter app, but executing the complex feature logic and UI patterns exactly as you discovered them in `teamlyst_reference`.
> 4. Acknowledge our Git Workflow: We will use feature branches and PRs for every phase.
> 
> Reply with a brief summary of the key architectural rules you discovered in my Flutter code, and a brief summary of the app we are migrating. **Do not write any code for the new app yet.** Tell me when you are ready for me to create the branch `feat/domain-models` and begin Phase 1.

---

## Phase 1: Foundation, DI, & Core Models

> **Prompt 1: Project Initialization & Domain Models**
> 
> Excellent. As you saw, the boilerplate (like `pubspec.yaml`, `get_it`, `auto_route`, and `BaseCubit`) is already set up in the starter project. Let's start building the Gym Tracker app using a Logic-First (TDD) approach based on the rules you analyzed. We will build the UI *last*.
> 
> 1. Add any additional dependencies needed for the migration to `pubspec.yaml` (e.g., `firebase_core`, `cloud_firestore`, `firebase_auth`, `mocktail`, `flutter_test`).
> 2. Generate the pure Domain Models (DTOs) for the Gym Tracker tracking logic using `equatable` and `json_serializable`:
>    - `UserModel`: `id`, `email`, `displayName`, `themePreference`.
>    - `TrainingType`: `id`, `name`, `color`, `icon`.
>    - `AttendanceDay`: `date`, `timestamp`, `trainingTypeId`, `notes`.
> 3. Write the Unit Tests for the JSON serialization of these models.
> 
> When finished, provide the `git commit` command (e.g., `feat: add core domain models and serialization tests`) and tell me to open a PR. I will tell you when the PR is merged and I am ready for Phase 2.

---

## Phase 2: Services & Repositories (Data Layer)

> **Prompt 2: Firebase Repositories & Tests**
> 
> Now we build the data layer, exactly matching the Firestore schema from the Angular app.
> 
> 1. Create an `AuthService` wrapping `FirebaseAuth` (signIn, register, signOut, resetPassword).
> 2. Create a `WorkoutRepository` to handle full CRUD operations for the `/users/{userId}/trainingTypes/{typeId}` subcollection. Use `snapshots()` to return Streams where appropriate.
> 3. Create an `AttendanceRepository` to handle read/writes for `/users/{userId}/attendances/{yearMonth}/days/{date}`.
> 4. Write comprehensive Unit Tests for these Repositories using `mocktail` to mock the Firestore/Auth instances. Ensure error handling is covered.
> 
> When finished, provide the `git checkout -b feat/data-layer` and `git commit` commands. Tell me to open a PR and wait for my confirmation before Phase 3.

---

## Phase 3: State Management (Cubits)

> **Prompt 3: Application Logic (Cubits) & Tests**
> 
> Connect the Domain to the State using Cubits that extend our `BaseCubit`.
> 
> 1. Create `AuthCubit`: Listens to auth state changes and manages user sessions.
> 2. Create `WorkoutCubit`: Consumes the `WorkoutRepository` and emits a `BaseState<List<TrainingType>>`.
> 3. Create `CalendarCubit`: Consumes the `AttendanceRepository` and emits a `BaseState<List<AttendanceDay>>`.
> 4. Create `StatsCubit`: Aggregates the attendance data to calculate total workouts and frequency breakdowns.
> 5. Write Unit Tests for all Cubits using `bloc_test`. Mock the repositories and verify that the Cubits emit `loading` -> `success` states in the correct order.
> 
> When finished, provide the `git checkout -b feat/state-management` and `git commit` commands. Tell me to open a PR and wait for my confirmation before Phase 4.

---

## Phase 4: Localization & Theme System

> **Prompt 4: Theme, Localization & Setup**
> 
> The core logic is tested. Let's prep the presentation layer using the patterns found in the starter project, mirroring the visual aesthetics of the Angular app.
> 
> 1. Set up the `CustomTheme` class defining both `lightTheme` and `darkTheme` utilizing the CSS variables from the Angular version (`--surface-100`, `--primary-500`, etc.).
> 2. Setup the `l10n.yaml` and `app_en.arb` file with the exact translation keys needed for the Login, Calendar, Stats, and Workout components (refer to the Angular `en.json`). Create a `LocaleHelper`.
> 3. Create the `AppRouter` using `auto_route` establishing routes for Splash, Login, Main navigation (Calendar/Stats), and Profile.
> 4. Provide the `main.dart` entry point that ties localization, routing, and DI together.
> 
> When finished, provide the `git checkout -b chore/theme-and-routing` and `git commit` commands. Tell me to open a PR and wait for my confirmation before Phase 5.

---

## Phase 5: Authentication & Profile UI

> **Prompt 5: Auth Flow & Settings UI**
> 
> Now we bind the UI to our perfectly tested logic.
> 
> 1. Build the shared controls: `CustomTextField` and `PrimaryButton`.
> 2. Build the `SplashPage` tracking the `AuthCubit` to redirect accurately.
> 3. Build the `LoginPage` and `RegisterPage` UI, mimicking the Angular web design but optimized for mobile. Tie them to the `AuthCubit`. 
> 4. Build the `ProfilePage` UI allowing theme toggling and logout.
> 
> When finished, provide the `git checkout -b feat/auth-profile-ui` and `git commit` commands. Tell me to open a PR and wait for my confirmation before Phase 6.
> 

---

## Phase 6: Core Feature UI (Calendar & Workout Management)

> **Prompt 6: The Interactive Calendar & Workouts**
> 
> 1. Build the Workout Management UI: A modal or page mimicking the Angular app, allowing the user to view, create, and delete `TrainingType`s (binding to the `WorkoutCubit`).
> 2. Build the `HomePage` containing the `table_calendar` widget.
> 3. Listen to both `WorkoutCubit` and `CalendarCubit`. Use the `table_calendar` `markerBuilder` to beautifully render the `TrainingType.icon` (emoji) inside the calendar cells for days with attendance records, just like the web version.
> 4. Create the bottom sheet that opens `onDaySelected` to mark attendance securely.
> 
> When finished, provide the `git checkout -b feat/calendar-workout-ui` and `git commit` commands. Tell me to open a PR and wait for my confirmation before Phase 7.

---

## Phase 7: Analytics UI & Final Connection

> **Prompt 7: Statistics Charts & App Polish**
> 
> 1. Build the `StatsPage` consuming the `StatsCubit`, replicating the Angular charts.
> 2. Implement the `fl_chart` library to visualize the Last 6 Months bar chart and the current month's pie chart breakdown.
> 3. Connect all pages to the `auto_route` Bottom Navigation Bar setup.
> 4. Review the final integration. Ensure all DI is correctly wired and state transitions in the UI are perfectly mapped to the `BaseState` pattern (showing spinners on loading, snackbars on errors).
> 
> When finished, provide the `git checkout -b feat/stats-and-polish` and `git commit` commands. Tell me to open the final PR!
