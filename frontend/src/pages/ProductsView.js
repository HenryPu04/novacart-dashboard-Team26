/**
 * ProductsView.js — Product Performance page
 *
 * This page shows:
 *   - A bar chart of top 10 products by revenue
 *   - A table with product name, category, units sold, and revenue
 *   - A date range filter
 *
 * The data fetching is already wired up.
 * Your job: implement the UI.
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Navbar from '../components/Navbar';
import { getProducts, getSummary } from '../utils/api';
import { useTheme } from '../utils/ThemeContext';

// Format currency helper
function formatCurrency(value) {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000)    return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(2)}`;
}

// Local-time YYYY-MM-DD (toISOString() would shift the date to UTC)
function toDateString(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Default range: the last 7 days of available data, ending on lastDate (YYYY-MM-DD)
function lastSevenDays(lastDate) {
  const [y, m, d] = lastDate.slice(0, 10).split('-').map(Number);
  const end   = new Date(y, m - 1, d);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start: toDateString(start), end: toDateString(end) };
}

// Shorten long product names for the chart axis
function truncate(text, max = 20) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Exact currency for the table, e.g. $30,578.58
function formatFullCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Table cell styles — use theme variables so the table follows dark mode
const thStyle = {
  textAlign: 'left', padding: '10px 12px',
  fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
  color: 'var(--text-muted)', borderBottom: '2px solid var(--border)',
};
const tdStyle = {
  padding: '10px 12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
};

export default function ProductsView() {
  const { dark } = useTheme();
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => { loadInitialData(); }, []);

  // Chart colours follow the theme (recharts needs real colour values, not CSS variables)
  const barColor  = dark ? '#4DB6AC' : '#00897B';
  const axisColor = dark ? '#90A4AE' : '#455A64';
  const gridColor = dark ? '#1E3248' : '#E0E6ED';

  // On first load, look up the last date in the data, then load that final week
  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const summary = await getSummary();
      const { start, end } = lastSevenDays(summary.date_range.end);
      setStartDate(start);
      setEndDate(end);
      await loadData(start, end);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadData(start = startDate, end = endDate) {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts(start, end);
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="page">

        <div className="filter-bar">
          <label>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <label>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className="btn-apply" onClick={() => loadData()}>Apply</button>
        </div>

        {error && (
          <div style={{ color: '#C62828', padding: 16, background: '#FFEBEE', borderRadius: 8, marginBottom: 16 }}>
            Error: {error}
          </div>
        )}

        {loading && <div className="loading">Loading products data…</div>}

        {!loading && !error && (
          <div className="grid-2">

            {/*
              STEP 1 — Top products bar chart
              products is: [{ product_id, name, category, units_sold, revenue }]
              Use a horizontal BarChart (layout="vertical").
              XAxis type="number", YAxis type="category" dataKey="name"
              Hint: truncate long product names to 20 chars
            */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Top 10 Products by Revenue</div>
              {products.length === 0 ? (
                <div className="loading" style={{ height: 300 }}>
                  No data for the selected dates
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart
                    data={products.map(p => ({ ...p, short_name: truncate(p.name) }))}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" tickFormatter={formatCurrency}
                           tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} />
                    <YAxis type="category" dataKey="short_name" width={150}
                           tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} />
                    <Tooltip
                      formatter={value => [formatFullCurrency(value), 'Revenue']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload.name}
                      cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                      contentStyle={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
                      }}
                    />
                    <Bar dataKey="revenue" fill={barColor} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/*
              STEP 2 — Products table
              Show all products in a table: Name | Category | Units Sold | Revenue
              Hint: use an HTML table or build with divs.
              Format revenue with the formatCurrency helper above.
            */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Product Details</div>
              {products.length === 0 ? (
                <div className="loading" style={{ height: 300 }}>
                  No data for the selected dates
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Category</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Units Sold</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.product_id}
                          style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}>
                        <td style={tdStyle}>{p.name}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{p.category}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{p.units_sold.toLocaleString('en-US')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatFullCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
