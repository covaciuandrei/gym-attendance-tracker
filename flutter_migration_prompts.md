# AI Prompt Sequence: Gym Tracker Flutter Migration (Logic-First & TDD)

> **User Instructions for File Setup & Git Workflow**:
> 1. Create a new root directory for this session (e.g., `gym-tracker-migration`).
> 2. Inside this directory, create a folder named `teamlyst` and a folder named `flutter starting project`.
>    - For `flutter starting project`: Copy ONLY the `lib` folder. **EXCLUDE** `app_router.gr.dart` and `injection.config.dart` (since they are auto-generated).
>    - For `teamlyst`: Copy ONLY the `lib` folder, but **EXCLUDE** `app_router.gr.dart` and `injection.config.dart` from the `core` folder. Also, **EXCLUDE** `fonts` and `images` from the `assets` folder. **IMPORTANT:** Only keep the structure and files for the **prod env**, and completely exclude any dev environment files.
> 3. Also copy the `src` folder from your **Angular Gym Presence Tracker Project** into this root directory. This provides the actual app logic, UI, and business requirements.
> 4. Provide this entire root directory to Sonnet 4.6 *first*.
> 5. Then, begin with the prompts below, sending them **one by one**.

> **Important Rule for the AI (Automated Git/PR Workflow):** You have access to my terminal, `git`, and the GitHub CLI (`gh`). After finishing the code and tests for *every single phase*, you must:
> 1. Stage and commit the code (`git add . && git commit -m "feature/chore: description"`).
> 2. Push the branch to origin (`git push -u origin <branch-name>`).
> 3. Create a Pull Request automatically using `gh pr create --title "<Phase Title>" --body "<Summary of what was built>"`.
> 4. Stop and provide me the link to the PR. Wait for me to review and merge it. Do not proceed to the next phase until I confirm the PR is merged and give you the next prompt.
>
> **Important Note on `gh` CLI:** Before Phase 1, verify the `gh` CLI is authenticated by running `gh auth status`. If it is not authenticated, stop and tell me — do not attempt to create PRs until this is confirmed working.

---

## Phase 0: Training & Context Analysis

> **Prompt 0: Project Initialization & Architecture Analysis**
>
> You are an Expert Senior Flutter Architect. Your ultimate goal is to migrate my existing Angular web application (`gym-presence-tracker`) into a pixel-perfect Flutter mobile app for **both iOS and Android**.
>
> My environment is fully working with **Flutter 3.41.0 and Java JDK 17**. Ensure all dependencies and solutions you provide are compatible with this setup.
>
> I have provided a workspace containing three reference folders:
> - The `src` folder of my Angular app.
> - The restricted `lib` folder of the `teamlyst` project (prod environment only).
> - The restricted `lib` folder of the `flutter starting project`.
>
> **Your task for this prompt:**
> 1. Start from scratch a new flutter project. Create it, remove its git (`rm -rf .git`), rename it to `gym_tracker`, and run a new `git init`. Create an initial commit.
> 2. Analyze the `lib` folders of both the `teamlyst` project and the `flutter starting project`. I want you to understand how I implement core features, complex business logic, routing (`auto_route`), dependency injection (`get_it`), and state management (`flutter_bloc`, `BaseCubit`). 
> 3. Copy the `clean_rebuild.sh` and `generate_assets.sh` scripts from the `teamlyst` project into the root of the new `gym_tracker` project.
> 4. Deeply analyze the original Angular app (`src`). Understand its features, UI structure, and Firebase schema. The new Flutter app MUST mimic the features and **exact UI design** from the Angular app.
> 5. Pay special attention to the Angular app's Firestore data structure, specifically the attendance path: `/users/{userId}/attendances/{yearMonth}/days/{date}`. This nested structure must be preserved exactly in the Flutter repositories — do not flatten or simplify it.
> 6. Acknowledge our Git Workflow: We will use feature branches and PRs for every phase in this newly initialized `gym_tracker` repository. Confirm that `gh auth status` returns an authenticated state.
>
> Reply with:
> - A brief summary of the key architectural rules you discovered from my Flutter projects.
> - A brief summary of the app we are migrating, including its full Firestore schema.
> - Confirmation that the shell scripts were copied and the project was initialized successfully.
>
> **Do not write any new app code yet.** Only setup the project internally and copy the scripts.
>
> Check out a new branch called `feature/domain-models` inside `gym_tracker` and wait for me to give you the Prompt for Phase 1.

---

## Phase 1: Foundation, DI, & Core Models

> **Prompt 1: Project Initialization & Domain Models**
>
> Excellent. Now that the project is initialized from scratch, apply the boilerplate patterns you analyzed (like `pubspec.yaml`, `get_it`, `auto_route`, and `BaseCubit`) into the new `gym_tracker` project. Let's start building the Gym Tracker app using a Logic-First (TDD) approach based on those rules. We will build the UI *last*.
>
> 1. Add any additional dependencies needed for the migration to `pubspec.yaml` (e.g., `firebase_core`, `cloud_firestore`, `firebase_auth`, `mocktail`, `flutter_test`, `json_serializable`, `json_annotation`, `build_runner`).
> 2. Generate the pure Domain Models (DTOs) for the Gym Tracker tracking logic using `equatable` and `json_serializable`:
>    - `UserModel`: `id`, `email`, `displayName`, `themePreference`.
>    - `TrainingType`: `id`, `name`, `color`, `icon`.
>    - `AttendanceDay`: `date`, `timestamp`, `trainingTypeId`, `notes`.
> 3. After generating the model files, run `dart run build_runner build --delete-conflicting-outputs` to generate the `.g.dart` serialization files. Confirm the generated files exist before proceeding.
> 4. Write the Unit Tests for the JSON serialization of these models.
>    *Note: I am completely new to testing in Flutter. Please explain exactly what these tests are doing and provide the exact terminal command I need to run to execute them.*
>
> When finished, automatically commit (including any `.g.dart` generated files), push, and open the PR for this phase using the `gh` tool. Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `feature/data-layer` before I give you Phase 2.

---

## Phase 2: Services & Repositories (Data Layer)

> **Prompt 2: Firebase Repositories & Tests**
>
> Now we build the data layer, exactly matching the Firestore schema from the Angular app.
>
> 1. Create an `AuthService` wrapping `FirebaseAuth` (signIn, register, signOut, resetPassword).
> 2. Create a `WorkoutRepository` to handle full CRUD operations for the `/users/{userId}/trainingTypes/{typeId}` subcollection. Use `snapshots()` to return Streams where appropriate.
> 3. Create an `AttendanceRepository` to handle read/writes for `/users/{userId}/attendances/{yearMonth}/days/{date}`. **Preserve this exact nested path — do not flatten it.**
> 4. Write comprehensive Unit Tests for these Repositories using `mocktail` to mock the Firestore/Auth instances. Ensure error handling is covered.
>    *Again, please explain the mocking concepts (`mocktail`) briefly so I understand how these tests work, and remind me the command to run them.*
>
> When finished, automatically commit, push, and open the PR for this phase using the `gh` tool. Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `feature/state-management` before I give you Phase 3.

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
>    *Explain how `bloc_test` works compared to standard unit tests, and how I can run these specific tests.*
>
> When finished, automatically commit, push, and open the PR for this phase using the `gh` tool. Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `chore/logic-integration-review` before I give you Phase 3.5.

---

## Phase 3.5: Logic Integration Review ✅ *(Checkpoint — no new code)*

> **Prompt 3.5: End-to-End Logic Audit**
>
> Before we build any UI, I want a full review of all the logic we've built so far.
>
> 1. Trace the full data flow for the two most critical user journeys end-to-end:
>    - **Marking attendance**: `CalendarCubit.markAttendance()` → `AttendanceRepository` → Firestore path → state emission.
>    - **Loading the calendar**: App start → `AuthCubit` emits authenticated user → `CalendarCubit` subscribes → emits `loading` → `success` with data.
> 2. Identify any gaps, missing error states, or broken DI wiring between Cubits and Repositories.
> 3. Check that all Cubits are correctly registered in `get_it` / `injectable` and that the dependency graph has no cycles or missing registrations.
> 4. List any issues found. If there are issues, fix them in this branch, commit, push, and open a PR titled `chore: logic integration review & fixes`. If there are no issues, confirm everything is clean and open a PR with that confirmation in the body.
>
> Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `chore/theme-and-routing` before I give you Phase 4.

---

## Phase 4: Localization & Theme System

> **Prompt 4: Theme, Localization & Setup**
>
> The core logic is tested and reviewed. Let's prep the presentation layer using the patterns found in the starter project, mirroring the visual aesthetics of the Angular app.
>
> 1. Set up the `CustomTheme` class defining both `lightTheme` and `darkTheme` utilizing the CSS variables from the Angular version (`--surface-100`, `--primary-500`, etc.).
> 2. Setup the `l10n.yaml` and `app_en.arb` file with the exact translation keys needed for the Login, Calendar, Stats, and Workout components (refer to the Angular `en.json`). Create a `LocaleHelper`.
> 3. Create the `AppRouter` using `auto_route` establishing routes for Splash, Login, Main navigation (Calendar/Stats), and Profile.
> 4. Provide the `main.dart` entry point that ties localization, routing, and DI together.
>
> When finished, automatically commit, push, and open the PR for this phase using the `gh` tool. Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `feature/auth-profile-ui` before I give you Phase 5.

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
> When finished, automatically commit, push, and open the PR for this phase using the `gh` tool. Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `feature/workout-management-ui` before I give you Phase 6.

---

## Phase 6: Workout Management UI

> **Prompt 6: Workout Types CRUD UI**
>
> 1. Build the Workout Management UI: A modal or page mimicking the Angular app, allowing the user to view, create, and delete `TrainingType`s (binding to the `WorkoutCubit`).
> 2. Ensure all loading, empty, and error states from `BaseState` are handled — show spinners on loading, snackbars on errors, and an empty state widget when no workout types exist.
> 3. Wire the delete action with a confirmation dialog before committing the Firestore delete.
>
> When finished, automatically commit, push, and open the PR for this phase using the `gh` tool. Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `feature/calendar-ui` before I give you Phase 7.

---

## Phase 7: Calendar UI & Attendance

> **Prompt 7: The Interactive Calendar**
>
> 1. Build the `HomePage` containing the `table_calendar` widget.
> 2. Listen to both `WorkoutCubit` and `CalendarCubit`. Use the `table_calendar` `markerBuilder` to beautifully render the `TrainingType.icon` (emoji) inside the calendar cells for days with attendance records, just like the web version.
> 3. Create the bottom sheet that opens `onDaySelected` to mark attendance securely, with the ability to select a training type and add optional notes.
> 4. Ensure the `CalendarCubit` correctly scopes data loading to the currently viewed month.
>
> When finished, automatically commit, push, and open the PR for this phase using the `gh` tool. Wait for my confirmation that the PR is merged. Check out `main`, pull the latest changes, and switch to a new branch for `feature/stats-and-polish` before I give you Phase 8.

---

## Phase 8: Analytics UI & Final Connection

> **Prompt 8: Statistics Charts & App Polish**
>
> 1. Build the `StatsPage` consuming the `StatsCubit`, replicating the Angular charts.
> 2. Implement the `fl_chart` library to visualize the Last 6 Months bar chart and the current month's pie chart breakdown.
> 3. Connect all pages to the `auto_route` Bottom Navigation Bar setup.
> 4. Review the final integration. Ensure all DI is correctly wired and state transitions in the UI are perfectly mapped to the `BaseState` pattern (showing spinners on loading, snackbars on errors).
> 5. Do a final pass: check for any hardcoded strings that should use localization keys, any missing error states, and any routes that are not yet registered in `AppRouter`.
>
> When finished, automatically commit, push, and open the final PR using the `gh` tool. Wait for my final review!