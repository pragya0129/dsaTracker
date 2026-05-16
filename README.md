# DSA Tracker
Live at:https://dsa-tracker-nu-lilac.vercel.app/
A full-stack application designed to track your Data Structures and Algorithms (DSA) journey. It provides features for solving challenges, community interaction, social features, and tracking your progress across different coding platforms.

## Features
- **User Authentication:** Secure JWT-based authentication with Spring Security.
- **Challenge Tracking:** Track and monitor DSA challenges and your problem-solving progress.
- **Community & Social:** Interact with other users, view recommendations, and stay engaged.
- **Notifications:** Receive updates on activities, milestones, and challenges.
- **Performance Optimized:** Utilizes Caffeine caching and Spring WebFlux for reactive endpoints.

## Tech Stack

### Backend
- **Framework:** Spring Boot 3
- **Security:** Spring Security with JWT (JSON Web Tokens)
- **Database:** PostgreSQL with Spring Data JPA
- **Caching:** Caffeine Cache
- **Reactive Stack:** Spring WebFlux
- **Build Tool:** Maven

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Routing:** React Router DOM

## Prerequisites
- **Java 17+**
- **Node.js 18+** (for frontend development)
- **PostgreSQL** database running locally or remotely

## Getting Started

### Backend Setup
1. Ensure PostgreSQL is running and update your database credentials in `src/main/resources/application.properties` or `application.yml`.
2. Build and run the backend using the provided Maven wrapper:
   ```bash
   ./mvnw clean install
   ./mvnw spring-boot:run
   ```
   *(On Windows, use `mvnw.cmd spring-boot:run`)*
   
   The backend API will be available at `http://localhost:8080`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend/website
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be accessible at `http://localhost:5173`.

## Project Structure
- `/src/main/java/com/example/dsa/`: Core Spring Boot backend source code.
  - Contains modular packages: `auth`, `challenge`, `community`, `notifications`, `platform`, `recommendation`, `social`, and `user`.
- `/frontend/website/`: Modern React-based frontend application.

## Deployment
For detailed deployment steps (including Docker instructions), please refer to the `DEPLOY.md` and `Dockerfile` provided in the repository root.
