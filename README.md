# Bike Store Observability Demo (Node.js)

A simple Node.js web app designed for **Azure App Service** deployment and observability demos with tools like **Dynatrace**.

The app provides:
- A friendly bike store home page UI
- A `Simulate Issue in Logs` button
- A backend endpoint that intentionally throws an error
- Structured error logging in application logs for monitoring validation

> On Azure App Service, the simulation endpoint is disabled by default unless
> `ENABLE_SIMULATION_ENDPOINT=true` is configured. This prevents repeated demo
> traffic from flooding production error logs.

## Architecture

- **Backend:** Node.js + Express
- **Frontend:** Static HTML/CSS/JS served by Express
- **Monitoring demo endpoint:** `POST /api/simulate-issue`
- **Health endpoint:** `GET /api/health`

## Project Structure

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── app.js
│   └── server.js
├── test/
│   └── app.test.js
├── package.json
└── README.md
```

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run

```bash
npm start
```

The app runs on `http://localhost:3000` (or `PORT` from environment).

To enable the demo error endpoint in Azure or other shared environments, set:

```bash
ENABLE_SIMULATION_ENDPOINT=true
```

### Test

```bash
npm test
```

## How the Error Simulation Works

1. Open the home page.
2. Click **Simulate Issue in Logs**.
3. The browser calls `POST /api/simulate-issue`.
4. The server intentionally throws and catches an error in middleware.
5. A structured error JSON is written to logs (`console.error`) including:
   - `errorId`
   - `message`
   - `code`
   - request path/method
   - timestamp
   - `trace_id` / `span_id` when `traceparent` is available
   - stack trace

This is ideal for validating detection, alerting, and tracing in Dynatrace.

## Deploy to Azure App Service

### Option A: Azure CLI (quick)

```bash
# Login
az login

# Variables
RG="rg-bike-demo"
PLAN="asp-bike-demo"
APP="bike-demo-<unique-name>"
LOCATION="eastus"

# Create resources
az group create --name "$RG" --location "$LOCATION"
az appservice plan create --name "$PLAN" --resource-group "$RG" --sku B1 --is-linux
az webapp create --resource-group "$RG" --plan "$PLAN" --name "$APP" --runtime "NODE|20-lts"

# Deploy from local git zip (run from repository root)
zip -r app.zip . -x "node_modules/*" ".git/*"
az webapp deploy --resource-group "$RG" --name "$APP" --src-path app.zip --type zip

# Configure startup if needed
az webapp config appsettings set --resource-group "$RG" --name "$APP" --settings WEBSITE_NODE_DEFAULT_VERSION="~20"
```

### Option B: GitHub Actions / Deployment Center

You can also connect this repository to Azure Deployment Center for CI/CD. Ensure the startup command resolves to:

```bash
npm start
```

## Dynatrace Monitoring Notes

After deploying:
1. Ensure Dynatrace OneAgent / Azure integration is enabled for the App Service.
2. Open the app and trigger normal traffic.
3. Click **Simulate Issue in Logs** multiple times.
4. In Dynatrace, validate:
   - server errors (HTTP 500)
   - error log entries (search by `BIKE_STORE_SIMULATION` or `errorId`)
   - service/request traces for `POST /api/simulate-issue`

## API Endpoints

- `GET /api/health` → `{ "status": "ok" }`
- `POST /api/simulate-issue` → `500` with JSON payload:

```json
{
  "error": "Internal Server Error",
  "errorId": "<uuid>",
  "message": "A simulated error was generated. Check app logs."
}
```

## Notes

This repository is intentionally built for observability demonstrations; simulated failures are expected behavior.
