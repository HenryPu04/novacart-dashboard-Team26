/**
 * OrdersView.js — Orders Overview page
 *
 * This page shows:
 *   - Stat cards: total revenue, total orders, unique customers
 *   - A bar/line chart of monthly revenue over time
 *   - A bar chart of revenue by city/state
 *   - A date range filter
 *
 * The data fetching is already wired up.
 * Your job: implement the UI — charts, stat cards, and layout.
 *
 * Useful libraries already installed:
 *   - recharts: BarChart, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Navbar from '../components/Navbar';
import { getSummary, getOrders, getCities } from '../utils/api';
import { useTheme } from '../utils/ThemeContext';

// Short currency for chart axes, e.g. $31K
function formatCurrency(value) {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000)    return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(2)}`;
}

// Exact currency for stat cards and tooltips, e.g. $1,284,750.00
function formatFullCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function EmptyState({ height }) {
  return <div className="loading" style={{ height }}>No data for the selected dates</div>;
}

export default function OrdersView() {
  const { dark } = useTheme();
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [summary,   setSummary]   = useState(null);
  const [orders,    setOrders]    = useState([]);
  const [cities,    setCities]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => { loadInitialData(); }, []);

  // Chart colours follow the theme (recharts needs real colour values, not CSS variables)
  const barColor  = dark ? '#4DB6AC' : '#00897B';
  const axisColor = dark ? '#90A4AE' : '#455A64';
  const gridColor = dark ? '#1E3248' : '#E0E6ED';
  const axisProps = { tick: { fill: axisColor, fontSize: 12 }, stroke: gridColor };
  const tooltipProps = {
    formatter: value => [formatFullCurrency(value), 'Revenue'],
    cursor: { fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
    contentStyle: {
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
    },
  };

  // Chart data: short month labels, and "City, ST" labels for the top 10 cities
  const monthlyData = orders.map(o => ({ ...o, label: o.month_name.slice(0, 3) }));
  const cityData    = cities.slice(0, 10).map(c => ({ ...c, label: `${c.city}, ${c.state}` }));

  // On first load, look up the last date in the data (all-time summary), then load that final week
  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const allTime = await getSummary();
      const { start, end } = lastSevenDays(allTime.date_range.end);
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
      const [s, o, c] = await Promise.all([
        getSummary(start, end),
        getOrders(start, end),
        getCities(start, end),
      ]);
      setSummary(s);
      setOrders(o);
      setCities(c);
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

        {/* ── Filter bar ─────────────────────────────────────────────────── */}
        <div className="filter-bar">
          <label>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <label>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className="btn-apply" onClick={() => loadData()}>Apply</button>
        </div>

        {/* ── Error state ────────────────────────────────────────────────── */}
        {error && (
          <div style={{ color: '#C62828', padding: 16, background: '#FFEBEE', borderRadius: 8, marginBottom: 16 }}>
            Error: {error}
          </div>
        )}

        {/* ── Loading state ──────────────────────────────────────────────── */}
        {loading && <div className="loading">Loading orders data…</div>}

        {/* ── Page content ───────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {/* Stat cards — /franchise/summary for the selected range */}
            <div className="stat-row">
              <div className="stat-box">
                <div className="label">Total Revenue</div>
                <div className="value">{formatFullCurrency(summary.total_revenue)}</div>
              </div>
              <div className="stat-box">
                <div className="label">Total Orders</div>
                <div className="value">{summary.total_orders.toLocaleString('en-US')}</div>
              </div>
              <div className="stat-box">
                <div className="label">Unique Customers</div>
                <div className="value">{summary.unique_customers.toLocaleString('en-US')}</div>
              </div>
            </div>

            {/* Monthly revenue — /franchise/orders for the selected range */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title" style={{ marginBottom: 16 }}>Monthly Revenue</div>
              {monthlyData.length === 0 ? <EmptyState height={280} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis tickFormatter={formatCurrency} width={64} {...axisProps} />
                    <Tooltip
                      {...tooltipProps}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload;
                        return row ? `${row.month_name} ${row.month.slice(0, 4)}` : '';
                      }}
                    />
                    <Bar dataKey="revenue" fill={barColor} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Revenue by city — top 10 from /franchise/cities (requirements D-02) */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Revenue by City</div>
              {cityData.length === 0 ? <EmptyState height={360} /> : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={cityData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tickFormatter={formatCurrency} {...axisProps} />
                    <YAxis type="category" dataKey="label" width={150} {...axisProps} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="revenue" fill={barColor} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
