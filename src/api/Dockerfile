# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
USER app
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["api/HomeDashApi.csproj", "api/"]
COPY ["web/home-dash/home-dash.esproj", "web/home-dash/"]
RUN dotnet restore "./api/HomeDashApi.csproj"

# Install Node.js and Angular CLI
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @angular/cli@20


COPY . .
RUN chmod +x ./api/replace_vars.sh
RUN ./api/replace_vars.sh ./web/home-dash/src/environments

WORKDIR "/src/api"

RUN dotnet build "./HomeDashApi.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./HomeDashApi.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
USER root
WORKDIR /app
COPY --from=publish /app/publish .

RUN mkdir -p /app/wwwroot /app/data && \
    chmod 777 /app/wwwroot /app/data && \
    chown -R app:app /app/wwwroot /app/data

USER app
ENTRYPOINT ["dotnet", "HomeDashApi.dll"]
