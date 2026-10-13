<div align="center">

<img src="assets/indigo-biomed-logo.png" alt="Indigo Bio Med" width="110">

# NovaCart Account Dashboard

### Solution Design Document

*Indigo BioMed · NovaCart online retail · Team 26*

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Date** | October 2026 |
| **Prepared by** | Team 26 App Consultants: Katie Nam, Eyan Jaffery, Harshi Brahmbhatt, Henry Pu |
| **Audience** | NovaCart account managers and business stakeholders |

</div>

---

## 1. The Problem and the Goal

Today, NovaCart account managers get order information from a weekly Excel report, or by asking someone to pull numbers for them. That is slow, and the numbers can differ depending on who prepared them.

**Goal:** give account managers one web page where they can look up orders, products and customers themselves, for any date range, using the same agreed numbers every time.

## 2. What We Are Building

A web dashboard with three views:

| View | What the manager sees |
|---|---|
| **Orders Overview** | Total revenue, total orders and unique customers, plus revenue by month and revenue by city |
| **Product Performance** | The top 10 products by revenue, as a chart and a table |
| **Customer List** | The top 20 customers by revenue, sortable by any column |

Every view has a start and end date filter. The dashboard also has a dark mode and a status light that shows whether the service is running.

**Out of scope:** changing any data (the dashboard is read-only), forecasting, and user-specific permissions. These appear under next steps.

## 3. How It Works

*Every component runs inside Snowflake. The manager's browser is the only thing outside it.*

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'IBM Plex Sans, Arial, sans-serif','primaryColor':'#BBDEFB','primaryTextColor':'#051B3F','primaryBorderColor':'#1C4EF5','lineColor':'#051B3F','clusterBkg':'#F5FAFF','clusterBorder':'#1C4EF5'}}}%%
flowchart LR
    U["<b>Account Manager</b><br/>Web browser"]

    subgraph SF["Snowflake: the data never leaves this boundary"]
        direction LR
        subgraph APP["Snowpark Container Services: runs the application"]
            direction LR
            R["<b>Router</b> (NGINX)<br/>Sends each request<br/>to the right place"]
            F["<b>Screens</b> (React)<br/>Orders, Products,<br/>Customers"]
            B["<b>Data service</b> (FastAPI)<br/>Applies business rules<br/>and asks for the data"]
        end
        D[("<b>Gold data tables</b><br/>Orders, Customers,<br/>Products, Dates")]
    end

    U -->|"1. Opens page<br/>(Snowflake sign-in)"| R
    R -->|"2. Page and charts"| F
    R -->|"3. Data requests"| B
    B -->|"4. Reads data<br/>(secure token)"| D

    classDef user fill:#051B3F,stroke:#051B3F,color:#FFFFFF
    classDef svc fill:#BBDEFB,stroke:#1C4EF5,color:#051B3F
    classDef data fill:#C8F5F5,stroke:#00BFA5,color:#051B3F
    class U user
    class R,F,B svc
    class D data
```

**In plain words:**

1. The manager opens the dashboard and signs in with their Snowflake account.
2. The router delivers the screens.
3. When the manager picks dates, the screens ask the data service for the numbers.
4. The data service reads the order data from Snowflake, applies the agreed business rules, and sends back the results to be drawn as charts and tables.

## 4. Numbers Managers Can Trust

The data service applies the same rules on every screen:

- **Revenue** counts only orders that are **delivered or shipped**. Pending, cancelled and returned orders are left out.
- **Customer details** (name, city, state) always use the customer's **current** record.
- **All amounts** are in US dollars.
- **Data coverage:** about 30,000 orders from 400 customers across 15 products, dated 1 January to 31 December 2022.

## 5. Key Technology Decisions and Trade-offs

| Decision | Why we chose it | Trade-off we accepted |
|---|---|---|
| **Run inside Snowflake (Snowpark Container Services) rather than on separate hosting** | The data stays where it already lives and is already governed. Users sign in with existing Snowflake accounts, and there is no extra infrastructure to secure. | Less flexibility than a general cloud host. Setup depends on Snowflake-specific tooling, and the Snowflake team must create and manage the services. |
| **A separate data service (FastAPI) between the screens and the database** | The business rules live in one place, so every screen shows the same numbers. It also produces built-in documentation that lets us test each data request against the requirements. | One more component to build, deploy and monitor than screens that query the database directly. |
| **A small local sample database for development** | Developers can build and test without touching live Snowflake data or sharing credentials. | The code must work with two databases, so we test against both to avoid surprises at deployment. |

## 6. Security and Data Handling

- The application runs **inside Snowflake**, and users sign in with their **Snowflake account**.
- The data service only **reads** data; there is no way to change orders, customers or products from the dashboard.
- Passwords and keys are **never stored in the code**. They are supplied securely at run time.
- Error messages shown to users are **generic**. Technical details stay in internal logs.

## 7. Assumptions, Risks and Open Questions

| Item | Detail |
|---|---|
| **Assumption** | The data is a static 2022 snapshot, so "latest" means the end of 2022. |
| **Assumption** | Data is shown by **US city and state** because it holds no country field. |
| **Risk** | Services in Snowflake are created by the NovaCart facilitator, so any delay there affects the deployment date. |
| **Open question** | What date range should the dashboard open on? |
| **Open question** | What does "franchise" mean for NovaCart, and who will sign in? |
| **Open question** | What should a manager see first when they open the dashboard? |
| **Open question** | Is city and state an acceptable replacement for country? |

## 8. Recommended Next Steps for NovaCart

1. **Connect live data** so the dashboard shows current orders instead of a 2022 snapshot.
2. **Add roles** so each account manager sees only their own accounts.
3. **Add customer detail pages** showing a single customer's order history.
4. **Export to Excel or CSV** to bridge the move away from the weekly spreadsheet.

---

<div align="center">

<sub>Prepared for Indigo BioMed · NovaCart Account Dashboard · Team 26 · Draft v0.1</sub>

</div>
