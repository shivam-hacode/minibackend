# UI backend — Evening result upload API

This document describes how a **separate UI/backend service** should call the minibackend API to push daily results (e.g. every **7:30 PM**). Paste this into another agent or repo to implement the caller.

---

## Overview

| Item | Value |
|------|--------|
| **Purpose** | Upsert one result row per category into MongoDB collection **`ui_evening_results`** only (does not touch main `Result` / Redis flows). |
| **Method** | `POST` |
| **Path** | `/api/ui-evening/upload` |
| **Full URL** | `{BASE_URL}/api/ui-evening/upload` |
| **Default server port** (this repo) | `5000` → example: `http://localhost:5000/api/ui-evening/upload` |

Use env on your UI backend, e.g. `MINIBACKEND_BASE_URL=https://your-host.com`.

---

## Step 1 — Login (JWT)

Evening upload **requires a logged-in session**: send the same **Bearer token** your app uses for other protected routes (`/api/result`, etc.).

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **Path** | `/api/login` |
| **Full URL** | `{BASE_URL}/api/login` |

**Body (JSON):**

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Success (200):**

```json
{
  "message": "Login successful",
  "authCode": "<JWT — use this as Bearer token>"
}
```

Store **`authCode`** and send it on every evening upload:

`Authorization: Bearer <authCode>`

**Failures:** `401` invalid credentials; `500` server error.

*(Same auth middleware as `src/middleware/authMiddleware.js`: missing/invalid token → `401` / `403`.)*

---

## Prerequisites (must exist before calls succeed)

1. **MongoDB `CategoryKeys` collection** must contain a document linking **`categoryname`** + **`key`** (same as app flow `POST /api/add-key-for-result-updation` with JWT).
2. If this pair is missing, the upload API returns **403** (`Invalid key for this category`).

Allowed **`key`** values are constrained by the backend enum (see `src/models/KeyModel.js`). The pair must still exist in DB.

---

## Authentication (two layers)

**1. JWT (required)** — Header:

`Authorization: Bearer <authCode>`

Token comes from **`POST /api/login`** (`authCode` in response). Without a valid token you get **`401`** (`Auth code required`) or **`403`** (`Invalid or expired auth code`).

**2. Category key (required)** — Same as before; **`categoryname`** + **`key`** must exist in **`CategoryKeys`**:

- Body field **`key`**, **or**
- Header **`X-Category-Key`**, **or**
- Header **`X-API-Key`**

If the pair is wrong → **`403`** (`Invalid key for this category`).

**Typical UI flow:** user logs in → your app keeps `authCode` → at 7:30 PM (or on submit) call upload with **Bearer + category key**.

---

## Request

### Headers

| Header | Required | Notes |
|--------|----------|--------|
| `Content-Type` | Yes | `application/json` |
| `Authorization` | Yes | `Bearer <authCode>` from `/api/login` |
| `X-Category-Key` or `X-API-Key` | Optional* | *Required if `key` is not in JSON body |

### JSON body — required fields

| Field | Type | Notes |
|-------|------|--------|
| `categoryname` | string | Must match a registered category (case-insensitive match vs DB). |
| `date` | string | Parsed as `DD/MM/YY` or `YYYY-MM-DD`; stored normalized to **`YYYY-MM-DD`**. |
| `time` | string | Accepted: `HH:mm`, `hh:mm A`, `hh:mma` (strict); normalized to **`hh:mm A`**. |
| `result` | string | Must be present and non-empty (validated; same pattern as legacy upload). |
| `number` | number or string | Cannot be `null` / `undefined` ( **`0` is allowed** ). |
| `next_result` | string | Required by validator; server maps stored `next_result` to the formatted **`time`** value internally (same behaviour as `/api/upload-data`). |

### JSON body — optional fields

| Field | Type | Notes |
|-------|------|--------|
| `mode` | string | Stored if provided |
| `key` | string | Use if not sending `X-Category-Key` / `X-API-Key` |

---

## Responses

| HTTP | Meaning |
|------|---------|
| **201** | New document created in `ui_evening_results`. Body: `{ message: "Created", data: <document> }` |
| **200** | Existing category document updated. Body: `{ message: "Updated", data: <document> }` |
| **400** | Missing/invalid fields, bad date, bad time, or missing `categoryname`/`key` for middleware |
| **401** | Missing `Authorization` header |
| **403** | Invalid/expired JWT **or** no matching `CategoryKeys` row for `key` + `categoryname` |
| **500** | Server error |

---

## Behaviour (upsert)

- One document **per category name** (case-insensitive).
- **`result`** array holds `{ date, time, number }` entries.
- Same **date + time** → updates **`number`** for that slot; otherwise **appends** a new slot.
- Top-level **`number`**, **`next_result`**, **`date`**, **`mode`**, **`key`** are updated on save.

---

## Example: cURL

```bash
curl -X POST "${MINIBACKEND_BASE_URL}/api/ui-evening/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_FROM_LOGIN" \
  -H "X-Category-Key: YOUR_CATEGORY_KEY" \
  -d '{
    "categoryname": "Your Category Name",
    "date": "2026-05-07",
    "time": "07:30 PM",
    "result": "ok",
    "number": 42,
    "next_result": "07:30 PM",
    "mode": "manual"
  }'
```

Same with key in body:

```bash
curl -X POST "${MINIBACKEND_BASE_URL}/api/ui-evening/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_FROM_LOGIN" \
  -d '{
    "categoryname": "Your Category Name",
    "key": "YOUR_CATEGORY_KEY",
    "date": "07/05/26",
    "time": "19:30",
    "result": "ok",
    "number": 42,
    "next_result": "07:30 PM",
    "mode": "manual"
  }'
```

---

## Example: Node `fetch`

```javascript
const baseUrl = process.env.MINIBACKEND_BASE_URL; // no trailing slash
// authCode from POST /api/login — store in memory / secure storage after login
const authCode = process.env.MINIBACKEND_AUTH_CODE;
const res = await fetch(`${baseUrl}/api/ui-evening/upload`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authCode}`,
    "X-Category-Key": process.env.CATEGORY_UPLOAD_KEY,
  },
  body: JSON.stringify({
    categoryname: process.env.CATEGORY_NAME,
    date: "2026-05-07",
    time: "7:30 PM",
    result: "ok",
    number: 42,
    next_result: "7:30 PM",
    mode: "scheduled",
  }),
});
const json = await res.json();
if (!res.ok) throw new Error(JSON.stringify(json));
```

---

## Scheduling (7:30 PM)

Implement on **your** UI/backend:

- **cron** (Linux), **node-cron**, **Cloud Scheduler**, **GitHub Actions** (`cron`), etc.
- Use server **timezone** explicitly (e.g. `Asia/Kolkata`) so “7:30 PM” is correct.

This minibackend repo **does not** schedule this call; it only exposes the HTTP API.

---

## Related code (this repo)

| Piece | Path |
|-------|------|
| Route | `src/router/uiEveningResultRoutes.js` — chain: **`authenticate`** → **`uiEveningKeyMiddleware`** → controller |
| Login | `POST /api/login` → `src/controller/AuthController.js` |
| JWT middleware | `src/middleware/authMiddleware.js` |
| Controller | `src/controller/UiEveningResultController.js` |
| Key middleware | `src/middleware/uiEveningKeyMiddleware.js` |
| Mongoose model / collection | `src/models/UiEveningResultModel.js` → collection **`ui_evening_results`** |
| Mount | `index.js` → `app.use("/api/ui-evening", uiEveningResultRoutes)` |

---

## Checklist for the implementing agent

1. [ ] Implement **`POST /api/login`** first; persist **`authCode`** for subsequent requests.
2. [ ] Set `MINIBACKEND_BASE_URL` (and category key env vars if needed).
3. [ ] Ensure `CategoryKeys` has `{ categoryname, key }` for each category you upload.
4. [ ] Call upload with **`Authorization: Bearer <authCode>`** plus category key (header or body).
5. [ ] `POST` JSON with all required fields; handle 401/403/400 with logging.
6. [ ] Schedule job at 7:30 PM local time if required (refresh login / token expiry if runs longer than JWT lifetime — default **24h** in `AuthController`).
