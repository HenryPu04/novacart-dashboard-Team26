# NovaCart Account Dashboard — Requirements Document

| | |
|---|---|
| **Team** | 26 |
| **Client** | NovaCart (online retail division of Indigo BioMed) |
| **Document version** | 1.0 |
| **Status** | Signed off |
| **Sign-off deadline** | October 12, 2026 (end of Day 1, before any code is written) |
| **Prepared by** | App Consultants: Katie Nam, Eyan Jaffery, Harshi Brahmbhatt, Henry Pu |
| **Reviewed by** | App Developers: Priyansh Vaghela, Hirab Abdourazak |

**Sources.** This document is built from the *Lab Guide* (requirement IDs API / FE / DEP / CON), the *Execution Guide* (Day 1 requirements template and "common mistakes"), the *Problem Statement*, and the starter repo (`backend/main.py`, `backend/connection.py`, `frontend/src`, `README.md`, `data/novacart_gold.db`). Where the Lab Guide and the starter repo/data disagree, this document follows the repo/data and records the change in Section 8 (Deviations from the Lab Guide).

---

## 1. Business Scope and Objective

**Problem.** NovaCart account managers (30+ countries) receive ad-hoc Excel reports from the analytics team every Friday. The reports are at least a week out of date, the numbers don't always match, and asking about a specific customer means sending a Slack message and waiting. The Data Engineering team has now produced clean, validated Gold tables (`fact_orders`, `dim_customer`, `dim_product`, `dim_date`) that nobody outside the data team can use.

**Objective.** Deliver a working web application, deployed on Snowpark Container Services (SPCS) and reachable by a public URL, that lets account managers explore order, product and customer data themselves, without sending a Slack message.

**Deliverables for the week** (Problem Statement):

1. A documented REST API (Python, FastAPI) over the Snowflake Gold tables.
2. A React frontend with three views: Orders Overview, Product Performance, Customer List.
3. The application deployed on SPCS at a public URL.
4. A Solution Design Document (1–2 pages) — App Consultant.
5. A client presentation (10 minutes + 5 minutes Q&A) — both roles.

**Technical stack:** Python 3.11+, FastAPI, React 18, Snowflake (`snowflake-connector-python`), SPCS OAuth, NGINX router, Docker (`linux/amd64`).

### 1.1 Scope

| In scope (MVP — must be delivered) | Optional (only if time allows) |
|---|---|
| Everything in Sections 2 – 5 | Customer history endpoint (OPT-01) |
| | Customer detail view (OPT-02) |

Nothing else is in scope. The MVP is agreed by both roles at the Day 1 alignment meeting (Execution Guide, Step 4).

### 1.2 Roles

| Role | Responsibility |
|---|---|
| App Developer | API, frontend, Docker images, README (with Consultant) |
| App Consultant | This document, validating each endpoint and view against it, Solution Design Document, presentation, README (with Developer) |
| Facilitator (NovaCart client contact) | Snowflake infrastructure, creating and suspending SPCS services, access for intern groups, public URL |

---

## 2. Data Rules and Definitions

These rules apply to every endpoint. They come from the starter repo README and code and from inspecting `novacart_gold.db`.

| ID | Rule |
|---|---|
| BR-01 | **Revenue** is `SUM(amount)` over orders with `status IN ('delivered', 'shipped')`. Orders with any other status (`pending`, `cancelled`, `returned`) are excluded from revenue, order counts, units sold and customer counts. |
| BR-02 | **Order count** is the number of distinct `order_id` values that satisfy BR-01. |
| BR-03 | **Unique customers** is the number of distinct `customer_id` values that have at least one order satisfying BR-01. |
| BR-04 | **Units sold** is `SUM(quantity)` over orders satisfying BR-01. |
| BR-05 | **Customer attributes** (name, city, state) come from `dim_customer` rows with `is_current = 1`. `dim_customer` keeps address history (SCD Type 2), so a customer can have more than one row. Only the current row is used in the MVP. |
| BR-06 | **Date filter.** `start` and `end` filter on `fact_orders.order_date`, format `YYYY-MM-DD`. |
| BR-07 | **Currency.** All orders in the current data are in USD, shown with a `$` prefix. |
| BR-08 | **Ranking.** "Top N" lists are ordered by revenue (or total spent) descending and limited in SQL (`LIMIT 10` / `LIMIT 20`), not in the frontend. |

**Data facts (verified in `data/novacart_gold.db`):** 30,000 orders, 400 customers, 15 products, 3 product categories (Electronics, Accessories, Storage), 10 cities in 10 states, order dates from 2022-01-01 to 2022-12-31. There is **no** country column and **no** franchise column.

---

## 3. API Requirements

Owner: App Developer. Validation: App Consultant, using Swagger at `/docs`, before the endpoint is marked done.

### 3.1 General API requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| API-01 | The API is built with Python 3.11+ and FastAPI. | `python3 --version` reports 3.11 or higher; `uvicorn main:app` starts with no import errors. |
| API-02 | The API connects to Snowflake using the `snowflake-connector-python` package. Connection parameters are loaded from environment variables — never hardcoded. | No account, username, password or key path appears in `backend/` code; every parameter is read with `os.getenv()` in `connection.py`; `.env` is listed in `.gitignore` and never committed. |
| API-03 | When running inside SPCS, the API authenticates to Snowflake using the OAuth token at `/snowflake/session/token`. No username or password required. | When `DATA_BACKEND=snowflake` and the token file exists, the connection uses `authenticator="oauth"` with that token and does not read `SNOWFLAKE_USERNAME` or a password. After deployment, `SYSTEM$GET_SERVICE_LOGS` shows a successful connection with no credential errors. |
| API-04 | Swagger documentation is accessible at `/docs` and describes every endpoint — parameters, response format, and example values. | `/docs` opens locally and on the deployed URL. It lists `/health`, `/authorize` and the 5 `/franchise/*` endpoints from Section 3.2. Each shows its parameters, response schema and filled-in example values. |
| API-05 | The API has a `/health` endpoint that returns the service status and confirms the Snowflake connection is working. | See Section 3.2, `GET /health`. |
| API-06 | All endpoints return JSON. Error responses include a descriptive message and an appropriate HTTP status code. | Every non-2xx response, including unhandled errors, has a JSON body containing a `detail` message and the matching HTTP status code. See Section 3.3. |

### 3.2 Endpoints

Base behaviour for all `GET /franchise/*` endpoints: JSON response; `start` / `end` are **query parameters** (never hardcoded in the query).

#### `GET /health`

| | |
|---|---|
| Purpose | Service status and database connectivity check. Used by the navbar status indicator (FE-05). |
| Parameters | None |
| Response 200 | `{ "status": "healthy", "uptime_s": 1234, "backend": "snowflake", "database": { "status": "connected" } }` |
| Response 503 | `{ "status": "degraded", "uptime_s": 1234, "database": { "status": "error", "message": "<generic text>" } }` |
| Acceptance criteria | Returns 200 with `status: "healthy"` and `database.status: "connected"` when the data backend is reachable. Returns 503 (never a silent 200) with `status: "degraded"` when it is not. The error message does not expose connection strings, credentials or stack traces. |

#### `GET /authorize`

| | |
|---|---|
| Purpose | SPCS OAuth identity endpoint, used by the frontend (FE-03). |
| Parameters | None (reads the `Sf-Context-Current-User` request header injected by SPCS) |
| Response 200 | `{ "user": "<snowflake username>", "status": "authorized" }` |
| Dev mode | When `CLIENT_VALIDATION=Dev`, returns `{ "user": "dev_user", "status": "authorized" }`. |
| Error | Missing `Sf-Context-Current-User` header outside Dev mode returns 422 with a JSON `detail`. |
| Acceptance criteria | Returns the authenticated Snowflake user inside SPCS and the mock user in Dev mode. |

#### `GET /franchise/summary`

| | |
|---|---|
| Purpose | All-time overview figures for the stat cards. |
| Parameters | None |
| Response 200 | `{ "total_revenue": 1284750.00, "total_orders": 8432, "unique_customers": 380, "date_range": { "start": "2022-01-01", "end": "2022-12-31" } }` *(illustrative values)* |
| Acceptance criteria | `total_revenue` follows BR-01, `total_orders` follows BR-02, `unique_customers` follows BR-03. `total_revenue` is rounded to 2 decimals. `date_range` is the MIN and MAX `order_date` of available data. Figures are all-time and do not change with the date filter. |

#### `GET /franchise/orders?start=YYYY-MM-DD&end=YYYY-MM-DD`

| | |
|---|---|
| Purpose | Monthly order volume and revenue; powers the monthly revenue chart. |
| Parameters | `start`, `end` (dates, `YYYY-MM-DD`) |
| Response 200 | `[ { "month": "2022-01", "month_name": "January", "order_count": 842, "revenue": 128450.00 }, ... ]` |
| Acceptance criteria | One object per month, in chronological order. Only orders within `start`–`end` that follow BR-01 are counted. `start` later than `end` returns 400. No matching data returns `[]`, never `null`. |

#### `GET /franchise/products?start=YYYY-MM-DD&end=YYYY-MM-DD`

| | |
|---|---|
| Purpose | Top 10 products by revenue; powers the products chart and table. |
| Parameters | `start`, `end` (dates, `YYYY-MM-DD`) |
| Response 200 | `[ { "product_id": "P001", "name": "Wireless Headphones", "category": "Electronics", "units_sold": 342, "revenue": 30578.58 }, ... ]` *(illustrative values)* |
| Acceptance criteria | At most 10 objects, ordered by `revenue` descending (`ORDER BY revenue DESC LIMIT 10`). `units_sold` follows BR-04. `start` later than `end` returns 400. No matching data returns `[]`, never `null`. |

#### `GET /franchise/customers?start=YYYY-MM-DD&end=YYYY-MM-DD`

| | |
|---|---|
| Purpose | Top 20 customers by revenue; powers the customer table. |
| Parameters | `start`, `end` (dates, `YYYY-MM-DD`) |
| Response 200 | `[ { "customer_id": "C001", "name": "Alice Johnson", "city": "Denver", "state": "CO", "total_orders": 14, "total_spent": 1240.50 }, ... ]` *(illustrative values)* |
| Acceptance criteria | At most 20 objects, ordered by `total_spent` descending (`LIMIT 20`). Name, city and state follow BR-05. `total_orders` follows BR-02 and `total_spent` follows BR-01. `start` later than `end` returns 400. No matching data returns `[]`, never `null`. |

#### `GET /franchise/cities?start=YYYY-MM-DD&end=YYYY-MM-DD`

| | |
|---|---|
| Purpose | Revenue by city and state; powers the "Revenue by City" chart. |
| Parameters | `start`, `end` (dates, `YYYY-MM-DD`) |
| Response 200 | `[ { "city": "Denver", "state": "CO", "order_count": 420, "revenue": 38430.00 }, ... ]` *(illustrative values)* |
| Acceptance criteria | One object per city/state combination, ordered by `revenue` descending. City and state follow BR-05. Only orders within `start`–`end` that follow BR-01 are counted. `start` later than `end` returns 400. No matching data returns `[]`, never `null`. |

#### OPT-01 (optional — only if time allows): `GET /franchise/customers/{customer_id}/history`

| | |
|---|---|
| Purpose | Full order history and address history (SCD Type 2) for one customer. |
| Parameters | `customer_id` (path) |
| Response 200 | JSON containing the customer's orders (from `fact_orders`) and all address records (all `dim_customer` rows for that `customer_id`, including `valid_from`, `valid_to`, `is_current`). |
| Acceptance criteria | Returns every order for the customer (all statuses, with `status` shown) and every address row, in date order. An unknown `customer_id` returns 404 with a JSON `detail`. Listed in `/docs` with example values. |

### 3.3 Error handling

| Status | When |
|---|---|
| 400 | Invalid request values, for example `start` later than `end` or a date not in `YYYY-MM-DD` format |
| 404 | A requested record does not exist (OPT-01 only). An empty result set is **not** an error; list endpoints return `200` and `[]`. |
| 422 | Missing required header on `/authorize`, or automatic FastAPI validation failure |
| 500 | Unexpected server or database error. The detail is logged server-side only; the client receives a generic message. |
| 501 | Starter skeleton response. Must not remain on any required endpoint when it is marked done. |
| 503 | `/health` when the data backend is unreachable |

**Acceptance criteria:** a global exception handler returns JSON (`{ "detail": "<message>" }`) for unhandled errors, so no plain-text or HTML error page is ever returned. Error messages never include stack traces, SQL, credentials or connection details.

### 3.4 Implementation checks (Execution Guide, "common mistakes")

| ID | Check |
|---|---|
| IMP-01 | Date ranges are never hardcoded in queries; always taken from query parameters. |
| IMP-02 | Queries limit rows (`LIMIT`), they do not return all rows. |
| IMP-03 | Empty results return `[]`, not `null`. |
| IMP-04 | Database cursors and connections are closed even when a query fails (`try/finally`). |
| IMP-05 | Queries use bound parameters, not string concatenation of user input. SQLite uses `?` and Snowflake uses `%s` as placeholders, so queries are tested on both backends. |

### 3.5 Data backends

| Environment | `DATA_BACKEND` | Authentication |
|---|---|---|
| Local development | `sqlite` (default; uses `data/novacart_gold.db`) or `snowflake` | SQLite: none. Local Snowflake: key-pair authentication from environment variables. |
| Deployed on SPCS | `snowflake` | OAuth token at `/snowflake/session/token` (API-03) |

---

## 4. Frontend Requirements

Owner: App Developer. Validation: App Consultant, before the view is marked done.

### 4.1 General frontend requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FE-01 | The frontend is built with React 18. | `package.json` lists React 18. |
| FE-02 | The frontend calls the backend API via `/api/*` — never directly to the Snowflake endpoint. | In the deployed app, `REACT_APP_BACKEND_URL=/api` and all requests go through the NGINX router. Locally, `REACT_APP_BACKEND_URL` points to the local backend (`http://localhost:8000`). No request ever goes to a Snowflake endpoint. All calls are made from `src/utils/api.js`. |
| FE-03 | When running inside SPCS, the frontend uses the Snowflake OAuth flow (the `/authorize` endpoint) to authenticate the user and stores the returned user identity. | The frontend calls `/authorize` on load and stores the returned `user`. `franchise_id` is not stored because it does not exist in the data (see Section 8, D-06). |
| FE-04 | All data fetching shows a loading state. If the API returns an error, the user sees a friendly message — not a blank screen or a JSON error. | A loading indicator shows while any request is in progress. On any API failure the page shows a readable message, not raw JSON and not an empty page. When the API returns `[]`, an "no data for the selected dates" message is shown (Execution Guide: handle empty results). |
| FE-05 | The app has a navigation bar with links to all three views and a service status indicator (using the `/health` endpoint). | The navbar links to Orders (`/orders`), Products (`/products`) and Customers (`/customers`). The status indicator shows *healthy* (`status` = `healthy`), *degraded* (any other `status`), or *offline* (backend unreachable), and refreshes periodically. |
| FE-06 | The app has a dark mode toggle that persists the user's preference. | The toggle switches between light and dark themes. After a page reload the previously chosen theme is still applied. |

### 4.2 Date range filter (shared by all three views)

| ID | Requirement |
|---|---|
| FLT-01 | Each view has a start date input, an end date input and an **Apply** button. |
| FLT-02 | Clicking **Apply** reloads that view's data for the chosen dates and shows the loading state while it does. |
| FLT-03 | The default start and end dates are not yet decided (Open Question OQ-01). |

### 4.3 View 1 — Orders Overview (`/orders`)

*Purpose:* high-level performance for account managers.

| ID | Component | Type | Data source |
|---|---|---|---|
| V1-01 | Total Revenue | Stat card | `/franchise/summary` → `total_revenue` |
| V1-02 | Total Orders | Stat card | `/franchise/summary` → `total_orders` |
| V1-03 | Unique Customers | Stat card | `/franchise/summary` → `unique_customers` |
| V1-04 | Monthly Revenue | Bar or line chart | `/franchise/orders` → `month_name`, `revenue` |
| V1-05 | Revenue by City | Bar chart | `/franchise/cities` → `city`, `revenue` |
| V1-06 | Date range filter | Input + Apply button | Section 4.2 |

**Acceptance criteria**

- The three stat cards sit at the top of the page and show values exactly as returned by `/franchise/summary`. They are all-time figures and do not change when the date filter is applied.
- The monthly revenue chart and the revenue-by-city chart show the data for the applied date range.
- Applying a new date range updates both charts.
- Loading, error and empty states follow FE-04.

### 4.4 View 2 — Product Performance (`/products`)

*Purpose:* help account managers identify top-revenue products.

| ID | Component | Type | Data source |
|---|---|---|---|
| V2-01 | Top 10 Products by Revenue | Bar chart | `/franchise/products` |
| V2-02 | Product table: name, category, units sold, revenue | Table | `/franchise/products` |
| V2-03 | Date range filter | Input + Apply button | Section 4.2 |

**Acceptance criteria**

- The chart shows at most 10 products, ranked by revenue.
- The table shows product name, category, units sold and revenue for the same products (10, or fewer if fewer exist).
- Applying a new date range updates both the chart and the table.
- Loading, error and empty states follow FE-04.

### 4.5 View 3 — Customer List (`/customers`)

*Purpose:* let account managers look into individual customers' performance.

| ID | Component | Type | Data source |
|---|---|---|---|
| V3-01 | Top 20 customers: name, city, state, orders, total spent | Table | `/franchise/customers` |
| V3-02 | Sortable column headers | Table headers | Client-side |
| V3-03 | Date range filter | Input + Apply button | Section 4.2 |

**Acceptance criteria**

- The table shows at most 20 customers with columns Name, City, State, Orders and Total Spent. The default order is Total Spent, highest first.
- Every column header is clickable. Clicking a header sorts by that column; clicking it again reverses between ascending and descending; the active column and direction are shown.
- Sorting applies to the (up to) 20 rows returned by the API.
- Total Spent is shown as currency.
- Applying a new date range updates the list.
- Loading, error and empty states follow FE-04.

### 4.6 OPT-02 (optional — only if time allows): Customer detail view

- Clicking a customer in View 3 opens a detail page for that customer.
- The page shows the customer's full order history and address history (SCD Type 2 data from `dim_customer`), using OPT-01.
- The page has a way back to the Customer List and follows FE-04 for loading, error and empty states.

---

## 5. Deployment Requirements

Owner: App Developer, unless stated. The facilitator manages the Snowflake infrastructure.

| ID | Requirement | Acceptance criteria |
|---|---|---|
| DEP-01 | The backend is packaged as a Docker image built for `linux/amd64`. A `.dockerignore` file excludes `node_modules` (if any), `.env` files and private keys. | Image builds with `--platform linux/amd64`. `backend/.dockerignore` excludes `.env` and key files (`rsa_key.p8`, `rsa_key.pub`). |
| DEP-02 | The frontend is packaged as a Docker image built for `linux/amd64`. | Image builds with `--platform linux/amd64`. |
| DEP-03 | An NGINX router image is used to route `/api/*` to the backend and all other requests to the frontend. | Requests to `/api/health` reach the backend `/health`; all other paths load the React app. |
| DEP-04 | All three images are pushed to the Snowflake Image Repository using the `build-and-push.sh` script provided in the starter repo. | `bash build-and-push.sh` (with `REPO_URL` and `GROUP` set) completes without errors, and the images are listed in the repository (`SYSTEM$REGISTRY_LIST_IMAGES`). Docker login uses `snow spcs image-registry login`, never `docker login` with a password. |
| DEP-05 | A README in the repository explains how to build, push, and deploy the application in clear steps. (Owner: both roles) | The README covers local setup, building and pushing images, notifying the facilitator, and verifying the deployment. |

### 5.1 Responsibilities in SPCS

| Facilitator | App team |
|---|---|
| Creates the compute pools and image repository | Builds and pushes the three images |
| Creates the SPCS services and grants access to the intern groups | Notifies the facilitator once images are pushed |
| Provides the public URL | Verifies the deployed app (all three views, `/health`, `/docs`) |
| Suspends services between sessions to manage cost; resumes them for Day 5 | Understands how the services work and can explain them in the presentation |

If something fails after deployment, check the service logs: `CALL SYSTEM$GET_SERVICE_LOGS('<service>', '0', '<container>', 50);`

---

## 6. App Consultant Deliverables

| ID | Requirement | Due | Status |
|---|---|---|---|
| CON-01 | Requirements document written and signed off by the App Developer before any code is written | End of Day 1 | In progress (this document) |
| CON-02 | Requirements document lists every API endpoint and frontend view with its acceptance criteria | End of Day 1 | Sections 3 and 4 |
| CON-03 | Requirements document is version-controlled in the GitHub repository | End of Day 1 | `docs/requirements.md` |
| CON-04 | Solution Design Document, 1–2 pages | Day 4 | Not started |
| CON-05 | SDD includes an architecture diagram: frontend, backend, NGINX router, Snowflake (Execution Guide also lists the browser) | Day 2 draft | Not started |
| CON-06 | SDD explains at least two technology decisions and their trade-offs | Day 4 | Not started |
| CON-07 | SDD is written for a non-technical audience | Day 4 | Not started |
| CON-08 | Presentation is 10 minutes + 5 minutes Q&A | Day 5 | Not started |
| CON-09 | Both roles speak: Developer gives the technical demo; Consultant covers business context, architecture decisions and trade-offs | Day 5 | Not started |
| CON-10 | Presentation includes a live demo of the deployed application | Day 5 | Not started |
| CON-11 | Presentation covers the problem, the solution, the architecture, two trade-offs and recommended next steps for NovaCart | Day 5 | Not started |

---

## 7. Milestones and Definition of Done

### 7.1 Daily goals (Execution Guide)

| Day | Developer | Consultant |
|---|---|---|
| 1 | Starter repo cloned, app running locally, Snowflake connection working | This document drafted and signed off by the developer |
| 2 | 2 working endpoints (`/health`, `/franchise/summary`) returning real data | Architecture diagram drafted, SDD started; validates the endpoints in `/docs` |
| 3 | All 5 `/franchise/*` endpoints working; frontend connected; first end-to-end data flow in the browser | SDD at 80%, presentation outline drafted |
| 4 | App deployed to SPCS with a public URL; README updated | Presentation complete and rehearsed; SDD complete |
| 5 | Live demo | Leads the presentation; final check 30 minutes before |

### 7.2 Definition of Done

An endpoint or view is **done** only when the App Consultant has tested it against its acceptance criteria in this document (endpoints via `/docs`) and it matches. If it does not match the requirements, it is not done.

The project is done when all of the following are true (Lab Guide checklist): *deployed, documented, and defensible.*

- [ ] API-01 to API-06
- [ ] `/health`, `/authorize`, and the 5 `/franchise/*` endpoints validated
- [ ] FE-01 to FE-06
- [ ] View 1, View 2, View 3
- [ ] DEP-01 to DEP-05 (all 3 images built and pushed)
- [ ] CON-01 to CON-03 (requirements document in repo)
- [ ] CON-04 to CON-07 (Solution Design Document complete)
- [ ] CON-08 to CON-11 (presentation ready with live demo)

---

## 8. Deviations from the Lab Guide

The Lab Guide describes an API and views that the delivered data and starter repo do not support. This document follows the repo and data. Each change is listed here so the validation in Step 7 of the Execution Guide is done against the correct expectation.

| ID | Lab Guide says | This document says | Reason |
|---|---|---|---|
| D-01 | Endpoint paths include `{franchise_id}`, e.g. `/franchise/{franchise_id}/summary` | Paths have no `franchise_id`, e.g. `/franchise/summary` | The Gold tables have no franchise column, so `franchise_id` cannot filter any data. The starter repo implements these paths. |
| D-02 | `/countries` endpoint and "Revenue by country" chart | `/franchise/cities` endpoint and "Revenue by City" chart | There is no country column in the data; only city and state. |
| D-03 | Customers have `first_name`, `last_name`, `country`; Customer List shows name and country | `name` (single field), `city`, `state`; Customer List columns are Name, City, State, Orders, Total Spent | `dim_customer` has a single `name` column and address city/state only. |
| D-04 | Summary returns `franchise_id` and `active_customers`; products return `product_name` | Summary has no `franchise_id` and uses `unique_customers`; products use `name` and also return `product_id`; orders also return `month_name` | The starter stubs and frontend are already built on these names. |
| D-05 | Stat cards show totals "for the selected date range" | Stat cards show all-time totals and do not change with the date filter; `/franchise/summary` takes no parameters | Decided by the team to match the starter stub. |
| D-06 | FE-03 stores the `franchise_id` | FE-03 stores the user identity returned by `/authorize` | There is no `franchise_id` in the data. |
| D-07 | `/health` example returns `snowflake: "connected"` (Execution Guide) | `/health` returns `status`, `uptime_s`, `backend` and `database.status` | The starter implementation and the frontend status indicator already use this shape. |
| D-08 | Stretch endpoint `/franchise/{franchise_id}/customers/{customer_id}/history` | `/franchise/customers/{customer_id}/history` | Same reason as D-01. |

---

## 9. Open Questions for the Client (Facilitator)

| ID | Question | Why it matters |
|---|---|---|
| OQ-01 | What date range should the filters default to? (Data covers 2022-01-01 to 2022-12-31.) | Execution Guide Day 1 question. Until answered, the starter code's placeholder of 2022-01-01 to 2022-12-31 stays in place. |
| OQ-02 | What does "franchise" mean in this context, and who is the user logging in? | Execution Guide Day 1 question. The data has no franchise concept (D-01, D-06). |
| OQ-03 | What does a NovaCart account manager need to see first when they open the dashboard? | Execution Guide Day 1 question. The app currently opens on Orders Overview. |
| OQ-04 | Is it acceptable to show revenue by city and state instead of by country, given the data only holds US city/state addresses? | Confirms deviations D-02 and D-03 with the client. |

---

## Approval

This document is signed off when each person below has entered their name and the date.

By entering their name below, all parties confirm that:

- Every API endpoint is documented with path, method, input parameters, expected response format, and acceptance criteria.
- Every frontend view is documented with name, purpose, components, and acceptance criteria.
- The deviations in Section 8 are understood and accepted.
- The App Developer has confirmed what is feasible by Day 4, and the MVP scope is agreed.

| Role | Name | Date |
|---|---|---|
| App Consultant | Katie Nam | October 12, 2026 |
| App Consultant | Eyan Jaffery | October 12, 2026 |
| App Consultant | Harshi Brahmbhatt | October 12, 2026 |
| App Consultant | Henry Pu | October 12, 2026 |
| App Developer | Priyansh Vaghela | October 12, 2026 |
| App Developer | Hirab Abdourazak | October 12, 2026 |

**Sign-off date:** October 12, 2026

**Version history**

| Version | Date | Change |
|---|---|---|
| 1.0 | October 12, 2026 | Initial version for developer sign-off |
