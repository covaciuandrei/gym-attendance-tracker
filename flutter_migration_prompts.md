# AI Prompt Sequence: Gym Tracker Flutter Migration (Logic-First & TDD)

> **User Instructions for File Setup**: 
> 1. Create a single folder on your computer called `gym-tracker`.
> 2. Copy the `lib` folder from your **Teamlyst Project** into this folder (to provide the Flutter architectural rules).
> 3. Copy the `src` folder from your **Angular Gym Presence Tracker Project** into this folder (to provide the actual app logic, UI, and business requirements).
> 4. Provide this entire `gym-tracker` folder to Sonnet 4.6 *first*.
> 5. Then, begin with the prompts below, sending them **one by one**.

---

## Phase 0: Training & Context Analysis

> **Prompt 0: Analyze My Architecture & Original App**
> 
> You are an Expert Senior Flutter Architect. Your ultimate goal is to migrate my existing Angular web application (`gym-presence-tracker`) into a pixel-perfect Flutter mobile app. 
> 
> I have provided a folder containing two things:
> 1. The source code for my existing Angular app. This is the app you are rebuilding in Flutter. Analyze its features, Firebase structure, and UI deeply.
> 2. The `lib` folder from my production Flutter app (`teamlyst`). This dictates *exactly* how I write Flutter code. 
> 
> **Your task for this prompt:**
> 1. Analyze the `teamlyst` routing setup (`auto_route`).
> 2. Analyze the `teamlyst` dependency injection setup (`get_it` and `injectable`).
> 3. Analyze the `teamlyst` State Management approach (`flutter_bloc`). Pay meticulous attention to how I structure the `BaseCubit` and `BaseState` classes to handle loading, success, and error states uniformly.
> 4. Understand that the new Flutter app you are building MUST mimic the features from the Angular app, but using the exact architectural rules you discovered in `teamlyst`.
> 
> Reply with a brief summary of the key architectural rules you discovered in my Flutter code, and a brief summary of the app we are migrating. **Do not write any code for the new app yet.** Tell me when you are ready to begin Phase 1.

---

## Phase 1: Foundation, DI, & Core Models

> **Prompt 1: Project Initialization & Domain Models**
> 
> Excellent. Now let's start building the Gym Tracker app using a Logic-First (TDD) approach based on the rules you analyzed. We will build the UI *last*.
> 
> 1. Provide the complete `pubspec.yaml` with all dependencies (`flutter_bloc`, `get_it`, `injectable`, `auto_route`, `json_serializable`, `equatable`, `firebase_core`, `cloud_firestore`, `firebase_auth`, `mocktail`, `flutter_test`).
> 2. Write the core `BaseState<T>` and `BaseCubit<T>` classes *exactly* as you saw them in `teamlyst`. Provide a unit test for `BaseCubit` to ensure it emits loading/success/error states correctly.
> 3. Write the root `injection.dart` file.
> 4. Generate the pure Domain Models (DTOs) for the Gym Tracker tracking logic using `equatable` and `json_serializable`:
>    - `UserModel`: `id`, `email`, `displayName`, `themePreference`.
>    - `TrainingType`: `id`, `name`, `color`, `icon`.
>    - `AttendanceDay`: `date`, `timestamp`, `trainingTypeId`, `notes`.
> 5. Write the Unit Tests for the JSON serialization of these models.

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

---

## Phase 4: Localization & Theme System

> **Prompt 4: Theme, Localization & Setup**
> 
> The core logic is tested. Let's prep the presentation layer using the patterns found in `teamlyst`, mirroring the visual aesthetics of the Angular app.
> 
> 1. Set up the `CustomTheme` class defining both `lightTheme` and `darkTheme` utilizing the CSS variables from the Angular version (`--surface-100`, `--primary-500`, etc.).
> 2. Setup the `l10n.yaml` and `app_en.arb` file with the exact translation keys needed for the Login, Calendar, Stats, and Workout components (refer to the Angular `en.json`). Create a `LocaleHelper`.
> 3. Create the `AppRouter` using `auto_route` establishing routes for Splash, Login, Main navigation (Calendar/Stats), and Profile.
> 4. Provide the `main.dart` entry point that ties localization, routing, and DI together.

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

---

## Phase 6: Core Feature UI (Calendar & Workout Management)

> **Prompt 6: The Interactive Calendar & Workouts**
> 
> 1. Build the Workout Management UI: A modal or page mimicking the Angular app, allowing the user to view, create, and delete `TrainingType`s (binding to the `WorkoutCubit`).
> 2. Build the `HomePage` containing the `table_calendar` widget.
> 3. Listen to both `WorkoutCubit` and `CalendarCubit`. Use the `table_calendar` `markerBuilder` to beautifully render the `TrainingType.icon` (emoji) inside the calendar cells for days with attendance records, just like the web version.
> 4. Create the bottom sheet that opens `onDaySelected` to mark attendance securely.

---

## Phase 7: Analytics UI & Final Connection

> **Prompt 7: Statistics Charts & App Polish**
> 
> 1. Build the `StatsPage` consuming the `StatsCubit`, replicating the Angular charts.
> 2. Implement the `fl_chart` library to visualize the Last 6 Months bar chart and the current month's pie chart breakdown.
> 3. Connect all pages to the `auto_route` Bottom Navigation Bar setup.
> 4. Review the final integration. Ensure all DI is correctly wired and state transitions in the UI are perfectly mapped to the `BaseState` pattern (showing spinners on loading, snackbars on errors).
