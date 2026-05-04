# syntax=docker/dockerfile:1.7
# Multi-stage build for KubeDash. Build from the repo root so submodules
# (src/RoboDodd.OrmLite and src/web/kube-dash/src/rd-ui) are available.
#
#   docker build -t kubedash:dev .
#   docker run -p 8080:8080 -v $HOME/.kube:/home/app/.kube:ro kubedash:dev

ARG DOTNET_VERSION=10.0
ARG NODE_VERSION=22

# ---------- Frontend build ----------
FROM node:${NODE_VERSION}-bookworm-slim AS web-build
WORKDIR /web

# Install rd-ui submodule deps and build the library first.
COPY src/web/kube-dash/src/rd-ui/package*.json src/web/kube-dash/src/rd-ui/
RUN cd src/web/kube-dash/src/rd-ui && npm ci

# App deps next.
COPY src/web/kube-dash/package*.json src/web/kube-dash/
RUN cd src/web/kube-dash && npm ci

# Copy source for both the rd-ui submodule and the kube-dash app, then build.
COPY src/web/kube-dash/src/rd-ui src/web/kube-dash/src/rd-ui
COPY src/web/kube-dash src/web/kube-dash
RUN cd src/web/kube-dash && npm run prod

# ---------- Backend build ----------
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS api-build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Restore against the project + submodule project ref.
COPY src/api/KubeDashApi.csproj src/api/
COPY src/RoboDodd.OrmLite/src/RoboDodd.OrmLite/RoboDodd.OrmLite.csproj src/RoboDodd.OrmLite/src/RoboDodd.OrmLite/
COPY common.props Directory.Build.props ./
RUN dotnet restore src/api/KubeDashApi.csproj

# Copy the rest of the API source + the submodule.
COPY src/api src/api
COPY src/RoboDodd.OrmLite src/RoboDodd.OrmLite

RUN dotnet publish src/api/KubeDashApi.csproj \
    -c $BUILD_CONFIGURATION \
    -o /app/publish \
    /p:UseAppHost=false

# ---------- Final runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS final
WORKDIR /app

# Copy publish output and the prebuilt SPA into wwwroot.
COPY --from=api-build /app/publish .
COPY --from=web-build /web/src/web/kube-dash/dist/kube-dash/browser ./wwwroot

# Writable mount points: SQLite db lives in /app/data (override via volume / k8s PVC).
RUN mkdir -p /app/data /app/wwwroot \
    && chown -R app:app /app

USER app
ENV ASPNETCORE_URLS=http://+:8080 \
    ConnectionStrings__DefaultConnection="Data Source=/app/data/kubedash.db"
EXPOSE 8080
ENTRYPOINT ["dotnet", "KubeDashApi.dll"]
