# Day 1 Requirements Document

# NovaCart Account Dashboard

**Document Version: 1.0**
**Status: Ready for Developer Sign-Off**
**Sign-off Deadline: October 12, 2026**

| Client | NovaCart (online retail division of Indigo BioMed) |
|---|---|
| Status | Draft — pending App Developer sign-off |

## Business Scope and Objective

Account managers currently receive weekly Excel reports from the analytics team that are outdated, inconsistent, and require manual follow-up. The NovaCart Account Dashboard will provide account managers with self-service, real-time access to order, customer, and product performance data so they can answer operational questions independently without waiting for the analytics team.

**Three required views:**

**Orders Overview — Display total revenue, total orders, active customers, and monthly trend chart**

**Product Performance — Display top 10 products by revenue with detailed product table**

**Customer List — Display top 20 customers by revenue with sortable columns (name, country, order count, total spent)**

**Required endpoints:**

GET /franchise/{franchise_id}/summary — Returns revenue, orders, customers, data date range

GET /franchise/{franchise_id}/orders — Returns monthly order and revenue trends

GET /franchise/{franchise_id}/products — Returns top 10 products by revenue

GET /franchise/{franchise_id}/customers — Returns top 20 customers by revenue

GET /franchise/{franchise_id}/countries — Returns revenue by country

GET /health — Service status check

**Technical stack: FastAPI (Python 3.11+), React 18, Snowflake, SPCS OAuth**

## 2. Frontend View Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FE-01 | Frontend built with React 18 | Uses React 18, react version in package.json |
| FE-02 | Calls backend via /api/* | Frontend calls backend API via /api/*—never directly to Snowflake endpoint |
| FE-03 | Runs inside SPCS using Snowflake OAuth flow | Snowflake OAuth flow to authenticate user and store franchise_ Requirement id |
| FE-04 | Shows loading state, with a friendly message if errored | if API returns error, user sees friendly message—not blank screen or JSON error |
| FE-05 | Navigation bar and Service status indicator | Can be taken to Views 1-3 using the navigation bar |
| FE-06 | Dark Mode toggle | Dark mode is turned on and off by user |

### 2.1 View 1: Orders Overview

Provide account managers with high-level franchise performance.

| Component | Type |
|---|---|
| Date Range Filter | Input control |
| Total Revenue Card | Summary Card |
| Total Orders Card | Summary Card |
| Revenue by Country | Bar Chart |
| Monthly Revenue over Time | Line Chart |

**Acceptance Criteria:**

Components render without errors

Date filter allows user to select start and end dates

Apply button updates all displayed data when clicked

Total revenue card displays correct value from API

Total orders card displays correct value from API

Monthly revenue chart visualizes data correctly

Revenue by country chart visualizes data correctly

Loading states display while fetching data

Error handling shows friendly message

View is responsive on desktop browser sizes

Empty state message displays when no data matches filters

### 2.2 View 2: Product Performance

Help account managers identify top-revenue products.

| Component | Type |
|---|---|
| Date Range Filter | Input control |
| Top 10 Products | Bar Chart |
| Product Table with name, category, units sold, and revenue | Data Table |

**Acceptance Criteria:**

Components render without errors

Date filter allows user to select start and end dates

Top 10 products chart displays products ranked by revenue

Product table shows product name, category, units sold, and revenue

Table displays exactly top 10 products (or fewer if fewer exist)

Changing date range updates both chart and table

Loading states display while fetching data

Error handling shows friendly message

View is responsive on desktop browser sizes

Empty state message displays when no data matches filters

### 2.3 View 3: Customer List

Allow account managers to search and investigate customers.

| Component | Type |
|---|---|
| Date Range Filter | Input control |
| Top 20 Customers with name, country, order count, and total spent | Data Table |
| Sortable by any column | Table Headers |

**Acceptance Criteria:**

Components render without errors

Date filter allows user to select start and end dates

Table displays top 20 customers by revenue

Table columns show customer name, country, order count, and total spent

All column headers are sortable

Clicking column header sorts of table in ascending/descending order

Changing date range updates customer list

Loading states display while fetching data

Error handling shows friendly message

View is responsive on desktop browser sizes

Empty state message displays when no customers in date range

## 3. API Requirements

| Requirement ID | Requirement | Acceptance Criteria |
|---|---|---|
| API-01 | Built with Python 3.11+ and FastAPI | requirements.txt pins fastapi==0.111.0; python3 --version reports 3.11+ in the dev/deploy environment; uvicorn main:app starts with no import errors. |
| API-02 | Connects to Snowflake using the snowflake-connector-python package. Connection parameters are loaded from environment variables — never hardcoded. | No Snowflake account, username, password, or key path is hardcoded anywhere in backend/; every connection parameter is read via os.getenv() in connection.py; .env stays in .gitignore and is never committed. |
| API-03 | When running inside SPCS, the API authenticates to Snowflake using the OAuth token at /snowflake/session/token. No username or password required. | When DATA_BACKEND=snowflake and /snowflake/session/token exists, get_snowflake_connection() authenticates with authenticator="oauth" using that token — SNOWFLAKE_USERNAME/PASSWORD are never read on that path. Verified once deployed: SYSTEM$GET_SERVICE_LOGS shows a successful connection with no credential errors. |
| API-04 | The Swagger documentation is accessible at /docs and describes every endpoint — parameters, response format, and example values. | Opening /docs (locally and on the deployed public URL) lists all 7 endpoints — /health, /authorize, and the 5 /franchise/* routes — each with parameters, response schema, and real example values filled in, not FastAPI's bare defaults. |
| API-05 | Has a /health endpoint that returns the service status and confirms the Snowflake connection is working. | GET /health returns 200 with status: "healthy" and database.status: "connected" when the DB is reachable, and 503 with status: "degraded" when it isn't. Already implemented in main.py — acceptance is confirming both cases actually occur, not building it. |
| API-06 | All endpoints return JSON. Error responses include a descriptive message and an appropriate HTTP status code. | Today, only 501 (HTTPException) and 503 (manual JSONResponse in /health) actually exist in main.py — both already return {detail/status: ...} JSON correctly. 400/404/500 are NOT yet implemented anywhere, and an unhandled exception currently falls through to FastAPI/Starlette's default handler, which returns plain text/HTML, not JSON. Acceptance: before this can be marked done, a global exception handler must be added (e.g. @app.exception_handler(Exception)) so every non-2xx response — not just the two that exist today — returns {detail: str} consistently. |

### 3.1 Endpoints Requirements

GET /franchise/{franchise_id}/summary — Returns revenue, orders, customers, data date range

GET /franchise/{franchise_id}/orders — Returns monthly order and revenue trends

GET /franchise/{franchise_id}/products — Returns top 10 products by revenue within date range

GET /franchise/{franchise_id}/customers — Returns top 20 customers by revenue within date range

GET /franchise/{franchise_id}/countries — Returns revenue by country within date range

GET /health — Service status check

**GET /health - Params: none. - Response 200: {status: "healthy", snowflake: "connected", timestamp}. Response 503 if the Snowflake/SQLite probe fails. - Acceptance: returns a non-200 status (not a silent 200) when the data backend is unreachable.**

**GET /franchise/summary - Params: none. - Response 200: {total_revenue, total_orders, active_customers, date_range: {start, end}}. - Acceptance: revenue/orders computed only over delivered/shipped statuses.**

**GET /franchise/orders?start=YYYY-MM-DD&end=YYYY-MM-DD - Params: start, end (optional dates, default to full range). - Response 200: list[{month, order_count, revenue}], chronologically ordered. - Acceptance: start > end → 400.**

**GET /franchise/products?start&end - Params: start, end (optional). - Response 200: list[{product_name, category, units_sold, revenue}], top 10 by revenue, ORDER BY revenue DESC LIMIT 10. - Acceptance: empty range returns [], never null.**

**GET /franchise/customers?start&end - Params: start, end (optional). - Response 200: list[{customer_id, name, city, state, total_orders, total_spent}], top 20 by spend, LIMIT 20. - Acceptance: single name field and city/state columns — the real schema has no first_name/last_name/country (unlike the Lab Guide’s example payload).**

**GET /franchise/cities?start&end - Params: start, end (optional). - Response 200: list[{city, state, order_count, revenue}], ORDER BY revenue DESC. - Acceptance: named /cities, not the Lab Guide’s /countries — the schema has no country column.**

**Error contract: every non-2xx response is {detail: str, status_code: int}.**

| Status | When |
|---|---|
| 400 | Malformed business logic (e.g. start > end) |
| 404 | No data at all from the configured backend |
| 422 | Pydantic validation failure (automatic) |
| 500 | Unhandled DB-driver error — logged server-side, generic message to client |
| 501 | Current skeleton state of all 5 endpoints before implementation — should not remain once “done” |
| 503 | /health reporting the data backend unreachable |

## 4. Deployment Requirements

| Requirement ID | Requirement |
|---|---|
| DEP-01 | The backend is packaged as a Docker image built for linux/amd64. A .dockerignore file excludes node_modules (if any), .env files, and private keys. |
| DEP-02 | The frontend is packaged as a Docker image built for linux/amd64. |
| DEP-03 | An NGINX router image is used to route /api/* to the backend and all other requests to the frontend. |
| DEP-04 | All three images are pushed to the Snowflake Image Repository using the build-and-push.sh script provided in the starter repo. |
| DEP-05 | A README in the repository explains how to build, push, and deploy the application in clear steps. |

## Approval Statement

By signing above, all parties confirm that:

Every API endpoint is documented with path, method, input parameters, expected response format, and acceptance criteria

Every frontend view is documented with name, purpose, components, and acceptance criteria

Requirements are sufficiently clear for implementation to begin

No additional clarification is needed before Day 2

**Sign-off Date: October 12, 2026**

App Consultants: Katie Nam, Eyan Jaffery, Harshi Brahmbhatt, Henry Pu

App Developers: Priyansh Vaghela, Hirab Abdourazak
