# Bike Store Observability Demo (Node.js)

A simple Node.js web app designed for **Azure App Service** deployment and observability demos with tools like **Dynatrace**.

The app provides:
- A friendly bike store home page UI
- A `Simulate Issue in Logs` button
- A backend endpoint that intentionally throws an error
- Structured error logging in application logs for monitoring validation

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

### Test

```bash
npm test
```

## How the Error Simulation Works

1. Open the home page.
2. Click **Simulate Issue in Logs**.
3. The browser calls `POST /api/simulate-issue`.
4. The server intentionally throws and catches an error in middleware.
5. A structured JSON entry is written to logs (`console.warn`) including:
   - `level` – `warn` for simulations, `error` for real failures
   - `category` – `simulation` or `app_error`
   - `errorId` – UUID for cross-referencing logs and responses
   - `message`, `code`, `stack`
   - `method`, `path`, `timestamp`
   - `traceId`, `spanId` – extracted from the incoming W3C `traceparent` header

This is ideal for validating detection, alerting, and tracing in Dynatrace.

## Log Classification

All structured log entries include a `level` and `category` field to reduce observability noise:

| `level` | `category`   | Meaning                                         |
|---------|--------------|-------------------------------------------------|
| `warn`  | `simulation` | Expected demo event triggered via the UI button |
| `error` | `app_error`  | Genuine unhandled application error             |
| `error` | *(process)*  | Uncaught exception or unhandled rejection       |
| `info`  | *(process)*  | Startup / ready messages                        |

**Recommended Dynatrace alert**: target `code == "BIKE_STORE_UNCAUGHT_EXCEPTION"` or `category == "app_error"` to isolate real failures from simulation noise.

**Startup noise** (npm `info`/`notice` lines and OpenSSL `rehash` warnings printed to stderr during `npm install`) are not application log entries. Filter them in Dynatrace log ingestion by excluding lines that do **not** match the `{` prefix of structured JSON.

## Trace / Span ID Propagation

When a downstream proxy or Dynatrace OneAgent injects a W3C [traceparent](https://www.w3.org/TR/trace-context/) header, the app parses it and includes `traceId` and `spanId` in every error log entry. This enables correlation between log events and distributed traces.

Example header injected by Dynatrace or Azure Front Door:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

The resulting log entry will contain:

```json
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7"
}
```

## Simulation Endpoint Rate Limiting

`POST /api/simulate-issue` is protected by an in-memory sliding-window rate limiter (default: **5 requests per minute per client IP**). Requests exceeding the limit receive:

```json
HTTP 429 Too Many Requests
{ "error": "Too Many Requests", "message": "Simulation endpoint rate limit exceeded. Try again later." }
```

The limit can be adjusted via the `SIMULATE_RATE_LIMIT` environment variable (e.g. `SIMULATE_RATE_LIMIT=10`).

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
   - log entries filtered by `category == "simulation"` or `code == "BIKE_STORE_SIMULATION"`
   - real failure alerts targeted on `category == "app_error"` or `code == "BIKE_STORE_UNCAUGHT_EXCEPTION"`
   - service/request traces for `POST /api/simulate-issue`, with `traceId`/`spanId` correlation

### Recommended DQL queries

Filter simulation noise (keep only true failures):

```dql
fetch logs
| filter azure.resource.group == "DYNATRACE_WEBAPP_DEMO_MX"
| filter status == "ERROR"
| filter NOT contains(content, "BIKE_STORE_SIMULATION")
| filter NOT startsWith(content, "npm ")
| fields timestamp, content, status, dt.source_entity, trace_id, span_id
```

Alert on uncaught exceptions:

```dql
fetch logs
| filter azure.resource.group == "DYNATRACE_WEBAPP_DEMO_MX"
| filter contains(content, "BIKE_STORE_UNCAUGHT_EXCEPTION")
| fields timestamp, content, status
```

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
