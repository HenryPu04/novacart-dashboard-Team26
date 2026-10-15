"""
main.py — NovaCart Account Dashboard API

Built with FastAPI. Auto-generated docs at: http://localhost:8000/docs

Endpoints:
  GET /health                                  — service health check
  GET /authorize                               — SPCS OAuth flow
  GET /franchise/{id}/summary                  — overview stats
  GET /franchise/{id}/orders                   — monthly order volume and revenue
  GET /franchise/{id}/products                 — top products by revenue
  GET /franchise/{id}/customers                — top customers by revenue
  GET /franchise/{id}/countries                — revenue by country (city/state for US data)

Data schema (from the DE capstone Gold layer):
  fact_orders:   order_id, customer_id, product_id, order_date, amount, currency, status, quantity, date_key
  dim_customer:  customer_id, name, email, addr_city, addr_state, valid_from, valid_to, is_current
  dim_product:   product_id, name, category, price
  dim_date:      date_key, year, quarter, month, month_name, day_of_week

Your job: implement the TODO sections in each endpoint.
The connection and query helpers are already set up in connection.py.
"""

import os
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from connection import get_connection, execute_query

load_dotenv()

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="NovaCart Account Dashboard API",
    description=(
        "REST API for the NovaCart account manager dashboard. "
        "Built on top of the Gold data layer produced by the Data Engineering team."
    ),
    version="1.0.0",
)

PORT              = int(os.getenv("PORT", 8000))
CLIENT_VALIDATION = os.getenv("CLIENT_VALIDATION", "Dev")
START_TIME        = time.time()

# SQLite uses "?" placeholders, Snowflake uses "%s" — pick the right one for bound params
PARAM = "%s" if os.getenv("DATA_BACKEND", "sqlite") == "snowflake" else "?"

# CORS — only needed for local development
# In SPCS, the NGINX router handles routing so CORS is not required
if CLIENT_VALIDATION == "Dev":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001"],
        allow_methods=["GET"],
        allow_headers=["*"],
    )


# ── Startup log ───────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    print("\nStarting NovaCart Dashboard API")
    print(f"Port:            {PORT}")
    print(f"Data backend:    {os.getenv('DATA_BACKEND', 'sqlite')}")
    print(f"Validation mode: {CLIENT_VALIDATION}")
    print(f"Docs:            http://localhost:{PORT}/docs\n")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    """
    Returns service health and confirms the database connection is working.
    Used by the frontend service status indicator.
    """
    uptime = round(time.time() - START_TIME)
    try:
        conn    = get_connection()
        results = execute_query(conn, "SELECT 1 AS ping")
        assert len(results) > 0
    except Exception as e:
        return JSONResponse(status_code=503, content={
            "status":   "degraded",
            "uptime_s": uptime,
            "database": {"status": "error", "message": str(e)},
        })
    return {
        "status":   "healthy",
        "uptime_s": uptime,
        "backend":  os.getenv("DATA_BACKEND", "sqlite"),
        "database": {"status": "connected"},
    }


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.get("/authorize", tags=["Auth"])
def authorize(request: Request):
    """
    SPCS OAuth authorization endpoint.

    When running inside SPCS, the platform injects the authenticated Snowflake
    username in the Sf-Context-Current-User header. This endpoint reads that
    header and returns the user's identity so the frontend can store it.

    In Dev mode: returns a mock user for local development.
    """
    if CLIENT_VALIDATION == "Dev":
        return {"user": "dev_user", "status": "authorized"}

    username = request.headers.get("sf-context-current-user")
    if not username:
        raise HTTPException(status_code=422, detail="Missing Sf-Context-Current-User header")

    return {"user": username, "status": "authorized"}


# ── Franchise endpoints ───────────────────────────────────────────────────────

@app.get("/franchise/summary", tags=["Franchise"])
def get_summary(start: Optional[str] = None, end: Optional[str] = None):
    """
    Returns an overview of orders, optionally limited to a date range.
    Without start/end it covers all orders in the database:
    - Total revenue (delivered + shipped orders only)
    - Total orders
    - Number of unique customers
    - Date range of available data (within the range, if one is given)

    Query parameters (optional):
      start: start date (YYYY-MM-DD)
      end:   end date (YYYY-MM-DD)

    Expected response:
    {
        "total_revenue": 1284750.00,
        "total_orders": 8432,
        "unique_customers": 380,
        "date_range": { "start": "2022-01-01", "end": "2022-12-31" }
    }

    TODO: implement this endpoint.
    Hints:
      - Use fact_orders table
      - Filter status IN ('delivered', 'shipped') for revenue
      - Use MIN/MAX of order_date for date_range
    """
    conn = get_connection()

    # ── YOUR CODE HERE ────────────────────────────────────────────────────────
    date_filter, params = "", []
    if start:
        date_filter += f" AND order_date >= {PARAM}"
        params.append(start)
    if end:
        date_filter += f" AND order_date <= {PARAM}"
        params.append(end)

    results = execute_query(conn, f"""
        SELECT
            COUNT(DISTINCT order_id)    AS total_orders,
            SUM(amount)                 AS total_revenue,
            COUNT(DISTINCT customer_id) AS unique_customers,
            MIN(order_date)             AS start_date,
            MAX(order_date)             AS end_date
        FROM fact_orders
        WHERE status IN ('delivered', 'shipped'){date_filter}
    """, tuple(params))

    row = results[0]
    return {
        "total_revenue":     round(row["total_revenue"] or 0, 2),
        "total_orders":      row["total_orders"],
        "unique_customers":  row["unique_customers"],
        "date_range": {"start": row["start_date"], "end": row["end_date"]},
    }
    # ─────────────────────────────────────────────────────────────────────────

    # raise HTTPException(status_code=501, detail="Not implemented yet — your turn!")


@app.get("/franchise/orders", tags=["Franchise"])
def get_orders(start: str = "2022-01-01", end: str = "2022-12-31"):
    """
    Returns monthly order volume and revenue for the given date range.
    Used to power the orders overview chart.

    Query parameters:
      start: start date (YYYY-MM-DD)
      end:   end date (YYYY-MM-DD)

    Expected response:
    [
        { "month": "2022-01", "month_name": "January", "order_count": 842, "revenue": 128450.00 },
        { "month": "2022-02", "month_name": "February", "order_count": 910, "revenue": 141230.00 }
    ]

    TODO: implement this endpoint.
    Hints:
      - JOIN fact_orders with dim_date on date_key
      - GROUP BY year, month, month_name
      - Filter order_date between start and end
      - Only include delivered + shipped for revenue
    """
    conn = get_connection()

    # ── YOUR CODE HERE ────────────────────────────────────────────────────────
    results = execute_query(conn, f"""
        SELECT
            dd.year                                                            AS year,
            dd.month                                                           AS month,
            dd.month_name                                                      AS month_name,
            COUNT(DISTINCT fo.order_id)                                        AS order_count,
            SUM(CASE WHEN fo.status IN ('delivered', 'shipped') THEN fo.amount ELSE 0 END) AS revenue
        FROM fact_orders fo
        JOIN dim_date dd ON fo.date_key = dd.date_key
        WHERE fo.order_date BETWEEN {PARAM} AND {PARAM}
        GROUP BY dd.year, dd.month, dd.month_name
        ORDER BY dd.year, dd.month
    """, (start, end))

    return [
        {
            "month":       f"{row['year']}-{row['month']:02d}",
            "month_name":  row["month_name"],
            "order_count": row["order_count"],
            "revenue":     round(row["revenue"] or 0, 2),
        }
        for row in results
    ]
    # ─────────────────────────────────────────────────────────────────────────


@app.get("/franchise/products", tags=["Franchise"])
def get_products(start: str = "2022-01-01", end: str = "2022-12-31"):
    """
    Returns the top 10 products by revenue for the given date range.

    Expected response:
    [
        { "product_id": "P001", "name": "Wireless Headphones", "category": "Electronics",
          "units_sold": 342, "revenue": 30578.58 }
    ]

    TODO: implement this endpoint.
    Hints:
      - JOIN fact_orders with dim_product on product_id
      - GROUP BY product_id, name, category
      - ORDER BY revenue DESC, LIMIT 10
    """
    conn = get_connection()

    # ── YOUR CODE HERE ────────────────────────────────────────────────────────
    results = execute_query(conn, f"""
        SELECT
            dp.product_id                                                      AS product_id,
            dp.name                                                            AS name,
            dp.category                                                        AS category,
            SUM(CASE WHEN fo.status IN ('delivered', 'shipped') THEN fo.quantity ELSE 0 END) AS units_sold,
            SUM(CASE WHEN fo.status IN ('delivered', 'shipped') THEN fo.amount ELSE 0 END)    AS revenue
        FROM fact_orders fo
        JOIN dim_product dp ON fo.product_id = dp.product_id
        WHERE fo.order_date BETWEEN {PARAM} AND {PARAM}
        GROUP BY dp.product_id, dp.name, dp.category
        ORDER BY revenue DESC
        LIMIT 10
    """, (start, end))

    return [
        {
            "product_id": row["product_id"],
            "name":       row["name"],
            "category":   row["category"],
            "units_sold": row["units_sold"] or 0,
            "revenue":    round(row["revenue"] or 0, 2),
        }
        for row in results
    ]
    # ─────────────────────────────────────────────────────────────────────────


@app.get("/franchise/customers", tags=["Franchise"])
def get_customers(
    start: str = "2022-01-01",
    end:   str = "2022-12-31",
    limit: int = Query(20, ge=0, description="Number of top customers to return. 0 returns all customers."),
):
    """
    Returns the top customers by revenue for the given date range
    (20 by default; set limit to change it, or 0 for all customers).

    Expected response:
    [
        { "customer_id": "C001", "name": "Alice Johnson", "city": "Austin",
          "state": "TX", "total_orders": 14, "total_spent": 1240.50 }
    ]

    TODO: implement this endpoint.
    Hints:
      - JOIN fact_orders with dim_customer on customer_id
      - Only use dim_customer WHERE is_current = 1
      - GROUP BY customer_id, name, addr_city, addr_state
      - ORDER BY total_spent DESC, LIMIT 20
    """
    conn = get_connection()

    # ── YOUR CODE HERE ────────────────────────────────────────────────────────
    results = execute_query(conn, f"""
        SELECT
            dc.customer_id                                                     AS customer_id,
            dc.name                                                            AS name,
            dc.addr_city                                                       AS city,
            dc.addr_state                                                      AS state,
            COUNT(DISTINCT fo.order_id)                                        AS total_orders,
            SUM(CASE WHEN fo.status IN ('delivered', 'shipped') THEN fo.amount ELSE 0 END) AS total_spent
        FROM fact_orders fo
        JOIN dim_customer dc ON fo.customer_id = dc.customer_id AND dc.is_current = 1
        WHERE fo.order_date BETWEEN {PARAM} AND {PARAM}
        GROUP BY dc.customer_id, dc.name, dc.addr_city, dc.addr_state
        ORDER BY total_spent DESC
        {f"LIMIT {limit}" if limit else ""}
    """, (start, end))

    return [
        {
            "customer_id":  row["customer_id"],
            "name":         row["name"],
            "city":         row["city"],
            "state":        row["state"],
            "total_orders": row["total_orders"],
            "total_spent":  round(row["total_spent"] or 0, 2),
        }
        for row in results
    ]
    # ─────────────────────────────────────────────────────────────────────────


@app.get("/franchise/cities", tags=["Franchise"])
def get_cities(start: str = "2022-01-01", end: str = "2022-12-31"):
    """
    Returns revenue grouped by city and state.
    Used to power the geographic breakdown chart.

    Expected response:
    [
        { "city": "Austin", "state": "TX", "order_count": 420, "revenue": 38430.00 }
    ]

    TODO: implement this endpoint.
    Hints:
      - JOIN fact_orders with dim_customer (is_current = 1) on customer_id
      - GROUP BY addr_city, addr_state
      - ORDER BY revenue DESC
    """
    conn = get_connection()

    # ── YOUR CODE HERE ────────────────────────────────────────────────────────
    results = execute_query(conn, f"""
        SELECT
            dc.addr_city                                                       AS city,
            dc.addr_state                                                       AS state,
            COUNT(DISTINCT fo.order_id)                                        AS order_count,
            SUM(CASE WHEN fo.status IN ('delivered', 'shipped') THEN fo.amount ELSE 0 END) AS revenue
        FROM fact_orders fo
        JOIN dim_customer dc ON fo.customer_id = dc.customer_id AND dc.is_current = 1
        WHERE fo.order_date BETWEEN {PARAM} AND {PARAM}
        GROUP BY dc.addr_city, dc.addr_state
        ORDER BY revenue DESC
    """, (start, end))

    return [
        {
            "city":        row["city"],
            "state":       row["state"],
            "order_count": row["order_count"],
            "revenue":     round(row["revenue"] or 0, 2),
        }
        for row in results
    ]
    # ─────────────────────────────────────────────────────────────────────────


@app.get("/franchise/customers/{customer_id}/history", tags=["Franchise"])
def get_customer_history(customer_id: str):
    """
    Returns the full order history and address history for one customer (stretch goal OPT-01).

    Address history comes from every dim_customer row for the customer (SCD Type 2),
    oldest first. Orders include every status, newest first.

    Expected response:
    {
        "customer_id": "C077", "name": "Diana Martin", "email": "diana.martin@novacart.com",
        "signup_date": "2022-02-27", "total_orders": 64, "total_spent": 5120.40,
        "addresses": [
            { "street": "66 Main St", "city": "Chicago", "state": "IL", "zip": "60601",
              "valid_from": "2022-01-01", "valid_to": "2022-06-01", "is_current": false }
        ],
        "orders": [
            { "order_id": "O29871", "order_date": "2022-12-30", "product_name": "Wireless Headphones",
              "category": "Electronics", "quantity": 1, "amount": 89.99, "status": "delivered" }
        ]
    }

    Unknown customer_id returns 404.
    """
    conn = get_connection()

    addresses = execute_query(conn, f"""
        SELECT
            name, email, signup_date,
            addr_street AS street, addr_city AS city, addr_state AS state, addr_zip AS zip,
            valid_from, valid_to, is_current
        FROM dim_customer
        WHERE customer_id = {PARAM}
        ORDER BY valid_from
    """, (customer_id,))

    if not addresses:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")

    orders = execute_query(conn, f"""
        SELECT
            fo.order_id     AS order_id,
            fo.order_date   AS order_date,
            dp.name         AS product_name,
            dp.category     AS category,
            fo.quantity     AS quantity,
            fo.amount       AS amount,
            fo.status       AS status
        FROM fact_orders fo
        LEFT JOIN dim_product dp ON fo.product_id = dp.product_id
        WHERE fo.customer_id = {PARAM}
        ORDER BY fo.order_date DESC, fo.order_id DESC
    """, (customer_id,))

    # Name/email come from the current row (BR-05); fall back to the latest row
    current = next((a for a in addresses if a["is_current"]), addresses[-1])
    return {
        "customer_id":  customer_id,
        "name":         current["name"],
        "email":        current["email"],
        "signup_date":  current["signup_date"],
        "total_orders": len(orders),
        "total_spent":  round(sum(float(o["amount"] or 0) for o in orders
                                  if o["status"] in ("delivered", "shipped")), 2),
        "addresses": [
            {
                "street":     a["street"],
                "city":       a["city"],
                "state":      a["state"],
                "zip":        a["zip"],
                "valid_from": a["valid_from"],
                "valid_to":   a["valid_to"],
                "is_current": bool(a["is_current"]),
            }
            for a in addresses
        ],
        "orders": [
            {
                "order_id":     o["order_id"],
                "order_date":   o["order_date"],
                "product_name": o["product_name"],
                "category":     o["category"],
                "quantity":     o["quantity"],
                "amount":       round(float(o["amount"] or 0), 2),
                "status":       o["status"],
            }
            for o in orders
        ],
    }
