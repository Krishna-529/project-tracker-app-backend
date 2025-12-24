# Project Tracker App

## Overview and Motivation

Project Tracker App is a full-stack application designed to streamline project management, task tracking, and team collaboration. The motivation behind this project is to provide a robust, scalable, and user-friendly platform for managing complex project structures, deadlines, and integrations, with a focus on flexibility and extensibility. The system is architected to support hierarchical project trees, real-time updates, and seamless integration with third-party services, making it suitable for both small teams and large organizations.

## High-Level Architecture

The application is divided into two main parts: the **backend** and the **frontend**. The backend is built with Node.js and TypeScript, providing RESTful APIs, authentication, real-time communication, and database management. The frontend is a modern React application using TypeScript and Tailwind CSS, offering an interactive and responsive user interface.

### Backend
- **API Server**: Handles HTTP requests, authentication, and business logic.
- **WebSocket Handler**: Manages real-time updates and notifications.
- **Database Layer**: Manages data persistence, schema validation, and complex queries.
- **Worker Processes**: Handles background jobs and asynchronous operations.

### Frontend
- **React SPA**: Provides a dynamic, component-driven UI for project navigation, task management, and user interactions.
- **State Management**: Utilizes hooks and context for efficient state updates and data flow.
- **UI Library**: Custom and reusable UI components for consistency and rapid development.

## Module-by-Module Explanation

### Backend Structure

#### `src/app.ts` & `src/server.ts`
- **app.ts**: Initializes the Express application, sets up middleware, routes, and error handling.
- **server.ts**: Boots the HTTP server, integrates WebSocket handlers, and manages server lifecycle.

#### `src/config/env.ts`
- Loads and manages environment variables, ensuring configuration is centralized and secure.

#### Controllers (`src/controllers/`)
- **authController.ts**: Manages user authentication, registration, and session logic.
- **integrationController.ts**: Handles integration with external services (e.g., Google APIs).
- **nodeController.ts**: Manages CRUD operations for project nodes (projects, tasks, etc.), including hierarchical tree logic.

#### Database Layer (`src/db/`)
- **index.ts**: Centralizes database connection and exports models.
- **schema.ts**: Defines the core database schema for projects, tasks, and users.
- **dailyQuest.ts/dailyQuestSchema.ts**: Specialized modules for recurring or daily tasks, including schema and logic.

#### Errors (`src/errors/AppError.ts`)
- Custom error class for consistent error handling and propagation throughout the backend.

#### Middleware (`src/middleware/`)
- **errorHandler.ts**: Centralized error handling middleware for Express.
- **requireAuth.ts**: Protects routes by enforcing authentication.
- **validateRequest.ts**: Validates incoming requests against schemas to ensure data integrity.

#### Routes (`src/routes/`)
- **authRoutes.ts**: Defines authentication-related endpoints.
- **integrationRoutes.ts**: Endpoints for third-party integrations.
- **nodeRoutes.ts**: Endpoints for project and task management.

#### Services (`src/services/`)
- **dailyQuestService.ts**: Business logic for daily/recurring tasks.
- **googleAuth.ts**: Handles OAuth and Google API integration.

#### Utilities (`src/utils/`)
- **catchAsync.ts**: Utility to wrap async route handlers for error catching.
- **fixPaths.ts**: Ensures file path consistency across environments.
- **jwt.ts**: Handles JWT creation, verification, and decoding.

#### Validators (`src/validators/nodeSchemas.ts`)
- Defines validation schemas for project nodes, ensuring data consistency and preventing malformed input.

#### WebSocket Handler (`client/wsHandler.js`)
- Manages real-time communication between server and clients, broadcasting updates and handling events.

#### Worker (`worker/processOneOp.js`)
- Processes background operations, such as batch updates or long-running tasks, to keep the main server responsive.

#### Scripts (`scripts/add-deadline-column.js`)
- Migration or utility scripts for database maintenance and schema evolution.

### Frontend Structure

#### Entry Points
- **index.html**: Main HTML template.
- **main.tsx**: Bootstraps the React application.

#### Core Components (`src/components/`)
- **NavLink, ProjectOverviewHeader, ProjectPickerModal, SearchBar, SidebarTree, ThemeToggle, ViewsDropdown**: Modular UI components for navigation, project selection, search, theming, and view management.
- **ProjectTree/**: Contains components for rendering and interacting with the hierarchical project/task tree (e.g., NodeRow, TaskCard, ExplorerPanel).
- **ui/**: A library of reusable UI primitives (buttons, dialogs, forms, etc.) for consistent design and rapid development.

#### Hooks (`src/hooks/`)
- **use-keyboard-shortcuts.tsx**: Custom hook for handling keyboard shortcuts.
- **use-mobile.tsx**: Detects and adapts to mobile devices.
- **use-toast.ts**: Provides toast notifications.
- **useServiceWorker.ts**: Manages service worker registration and updates.

#### Lib (`src/lib/`)
- **api.ts**: Centralized API client for backend communication.
- **mockData.ts**: Provides mock data for development/testing.
- **nodeTree.ts**: Utilities for manipulating the project/task tree structure.
- **utils.ts**: General-purpose utility functions.

#### Pages (`src/pages/`)
- **Index.tsx**: Main dashboard or landing page.
- **Login.tsx**: User authentication page.
- **NotFound.tsx**: 404 error page.

#### Types (`src/types/`)
- **node.ts, project.ts**: TypeScript type definitions for core data structures.

#### Configuration
- **tailwind.config.ts, postcss.config.js**: Styling and build configuration for Tailwind CSS.
- **vite.config.ts**: Vite build and dev server configuration.
- **tsconfig*.json**: TypeScript configuration files for different build targets.

## Key Algorithms, Logic, and Workflows

### Hierarchical Project Tree
The core of the application is the hierarchical project/task tree, allowing users to nest projects, tasks, and subtasks. The backend uses efficient tree traversal and manipulation algorithms to support operations like moving nodes, adding children, and reordering tasks. The frontend mirrors this structure, providing drag-and-drop and real-time updates.

### Real-Time Updates
WebSocket communication ensures that changes made by one user are instantly reflected for all connected users. The backend broadcasts updates using the `wsHandler.js` module, while the frontend listens and updates the UI accordingly.

### Authentication and Authorization
The system uses JWT-based authentication, with secure session management and route protection. OAuth integration (e.g., Google) is supported for seamless login experiences.

### Data Validation and Error Handling
All incoming data is validated against schemas before processing, preventing invalid or malicious input. Errors are handled centrally, with meaningful messages returned to the client and logged for diagnostics.

### Background Processing
Long-running or resource-intensive operations are offloaded to worker processes, ensuring the main server remains responsive. This includes batch updates, scheduled tasks, and integration syncs.

## Design Decisions and Trade-offs
- **Monorepo Structure**: Keeping backend and frontend in a single repository simplifies development and deployment but requires careful organization.
- **Custom UI Library**: Building a custom set of UI components ensures consistency and flexibility but increases initial development time.
- **WebSocket for Real-Time**: Chosen for low-latency updates, but requires careful state management on both client and server.
- **Schema Validation**: Using explicit schemas for validation improves reliability but adds maintenance overhead as the system evolves.

## Edge Cases, Validations, and Constraints
- **Tree Integrity**: Prevents cycles and orphaned nodes in the project tree.
- **Concurrent Updates**: Handles race conditions and ensures data consistency during simultaneous edits.
- **Authentication**: Protects sensitive routes and data, with robust session expiration and token invalidation.
- **Input Validation**: Rejects malformed or incomplete data at the API boundary.
- **Error Propagation**: Ensures all errors are caught and reported in a user-friendly manner.

## Ensuring Correctness, Performance, and Scalability
- **Automated Validation**: All API inputs are validated before processing.
- **Centralized Error Handling**: Reduces the risk of unhandled exceptions.
- **Efficient Data Structures**: Tree operations are optimized for performance, even with large project hierarchies.
- **Background Jobs**: Offloads heavy tasks to keep the main server fast.
- **Component Reuse**: Frontend uses reusable components to minimize bugs and improve maintainability.
- **Testing**: Includes scripts and mock data for development and testing.

## Function and Feature Explanations

### Backend
- **Authentication**: Handles user login, registration, and session management, supporting both JWT and OAuth.
- **Project/Task Management**: CRUD operations for projects and tasks, supporting nested structures and real-time updates.
- **Integrations**: Connects with external services for enhanced functionality (e.g., calendar sync).
- **Error Handling**: Consistent error responses and logging for easier debugging.
- **Background Processing**: Handles scheduled and long-running tasks asynchronously.

### Frontend
- **Project Tree UI**: Interactive, drag-and-drop interface for managing projects and tasks.
- **Modals and Dialogs**: For project selection, creation, and editing.
- **Search and Navigation**: Fast, keyboard-accessible search and navigation.
- **Theming**: Light/dark mode toggle for accessibility.
- **Notifications**: Real-time feedback via toast messages.

## Example: Adding a New Task
1. User clicks "Add Task" in the UI.
2. Frontend sends a POST request to the backend API with task details.
3. Backend validates the request, updates the database, and broadcasts the change via WebSocket.
4. All connected clients receive the update and refresh the project tree in real time.

## Conclusion


Project Tracker App is a comprehensive, scalable, and extensible platform for project management. Its modular architecture, robust validation, and real-time features make it suitable for a wide range of use cases. The codebase is organized for clarity and maintainability, with detailed error handling and validation to ensure reliability. New developers can quickly onboard by following the structure and conventions outlined above, without needing to read every line of code.

---

## Author

**Krishna Satyam**