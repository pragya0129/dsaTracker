# ─── Multi-stage build ────────────────────────────────────────────────────
# Stage 1: compile with JDK + Maven. Keeps the final image small (~200 MB)
# instead of shipping Maven and the whole JDK.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Cache dependencies separately from source so code-only changes don't
# re-download the entire Maven repo on every build.
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw && ./mvnw -q dependency:go-offline

COPY src src
RUN ./mvnw -q clean package -DskipTests

# ─── Stage 2: runtime (JRE only) ──────────────────────────────────────────
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Render injects PORT at runtime; Spring honours server.port which we read
# from the PORT env var in application.properties.
EXPOSE 8080

# exec form so Java is PID 1 and receives SIGTERM cleanly on redeploy.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
