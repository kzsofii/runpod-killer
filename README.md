# RunPod Compute Management

A small Node.js service I built as part of the compute-management system for MIT AI Alignment.

The broader system used Airtable to collect and approve GPU requests, Slack for notifications, Railway for hosting, and RunPod for compute. This repository contains the deletion webhook used to terminate a specified RunPod pod through the RunPod API.

## Functionality

- Exposes a `POST /delete-pod` endpoint
- Accepts a RunPod pod ID and shared secret
- Authenticates the request
- Deletes the specified pod using the RunPod REST API
- Returns a success or error response

The Airtable automations, Slack notifications, and scheduled cleanup workflow were configured separately and are not included in this repository.

## Setup

The service requires Node.js 18 or newer and has no external runtime dependencies.

Set the following environment variables:

```bash
export RUNPOD_API_KEY="<your-runpod-api-key>"
export WEBHOOK_SECRET="<your-shared-secret>"
export PORT=3000
```

Then start the service:

```bash
npm start
```

`PORT` is optional and defaults to `3000`.

## Request format

Send a POST request to `/delete-pod`:

```bash
curl -X POST http://localhost:3000/delete-pod \
  -H "Content-Type: application/json" \
  -d '{"podId":"example-pod-id","secret":"example-shared-secret"}'
```

With valid credentials and a real pod ID, this request permanently deletes the pod.

## Security

Store credentials in environment variables or your hosting provider's secret manager. Do not commit `.env` files or real credentials.

The service will not start unless both `RUNPOD_API_KEY` and `WEBHOOK_SECRET` are configured.
