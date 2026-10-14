# REST API

Base URL: `http://localhost:4000/api`. All endpoints except health and login require `Authorization: Bearer <JWT>`. JSON request bodies are expected.

## Authentication
- `POST /auth/login` — `{ "email": "sales@forgeflow.local", "password": "Sales123!" }`
- `GET /health` — liveness check (no auth)

## Catalog / inventory
- `GET /products` — product master and current inventory.
- `GET /inventory` — physical, reserved, and calculated available quantities.
- `PATCH /inventory/:productId` — **ADMIN only**; `{ "physicalQuantity": 250 }`. Physical stock cannot be set below reserved stock.

## Enquiries — ADMIN, SALES
- `GET /enquiries`
- `POST /enquiries`
  ```json
  {
    "companyName":"ABC Engineering Pvt. Ltd.",
    "contactPerson":"Neha Shah",
    "mobile":"9876543210",
    "email":"neha@example.com",
    "city":"Pune",
    "enquiryDate":"2026-10-14",
    "requiredDate":"2026-11-15",
    "notes":"Urgent requirement",
    "items":[{"productId":1,"quantity":100},{"productId":2,"quantity":4}]
  }
  ```

## Quotations — ADMIN, SALES
- `GET /quotations`
- `POST /quotations` — `{ "enquiryId": 1, "validUntil": "2026-11-15", "items": [{"productId":1,"quantity":10,"unitPrice":450,"discountPercent":5,"gstPercent":18}] }`. Server calculates line and grand totals; client totals are ignored.
- `PATCH /quotations/:id/status` — `{ "status": "SENT" | "ACCEPTED" | "REJECTED" }`. Valid transitions: DRAFT→SENT/REJECTED, SENT→ACCEPTED/REJECTED.
- `POST /quotations/:id/convert` — accepted quotations only; creates one order due to row lock and unique quotation reference.

## Sales orders — ADMIN, SALES can view; ADMIN-only actions
- `GET /sales-orders`
- `POST /sales-orders/:id/confirm` — **ADMIN only**. Locks inventory rows in sorted product ID order, validates availability, reserves all lines atomically.
- `POST /sales-orders/:id/dispatch` — **ADMIN only**; `{ "vehicleNumber":"MH12AB1234", "driverName":"Amit Patil" }`. Decreases physical and reserved stock in one transaction.
- `POST /sales-orders/:id/cancel` — **ADMIN only**. Pending orders cancel; confirmed orders release reserved stock.

## Error format
`{ "error": "Human-readable reason" }`; HTTP 400 invalid input/business rule, 401 missing/invalid token, 403 role restriction, 404 missing resource, 409 conflict/stock shortage, 500 unexpected server error.
