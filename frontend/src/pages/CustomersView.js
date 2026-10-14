/**
 * CustomersView.js — Customer List page
 *
 * This page shows:
 *   - A sortable table of top 20 customers by revenue
 *   - Columns: Name | City | State | Orders | Total Spent
 *   - A date range filter
 *
 * The data fetching is already wired up.
 * Your job: implement the UI and the sorting logic.
 */

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getCustomers, getSummary } from '../utils/api';

function formatCurrency(value) {
  if (!value) return '$0';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// Table cell styles — use theme variables so the table follows dark mode
const thStyle = {
  textAlign: 'left', padding: '10px 12px', cursor: 'pointer', userSelect: 'none',
  fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
  color: 'var(--text-muted)', borderBottom: '2px solid var(--border)',
};
const tdStyle = {
  padding: '10px 12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
};

export default function CustomersView() {
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [customers,  setCustomers]  = useState([]);
  const [sortBy,     setSortBy]     = useState('total_spent');
  const [sortDir,    setSortDir]    = useState('desc');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => { loadInitialData(); }, []);

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
      const data = await getCustomers(start, end);
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Sort handler — toggles direction if same column, resets to desc if new column
  function handleSort(column) {
    if (sortBy === column) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  }

  // Apply sort to customers array
  const sorted = [...customers].sort((a, b) => {
    const va = a[sortBy], vb = b[sortBy];
    if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  // Sort indicator helper
  const sortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

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
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
            {customers.length} customers
          </span>
        </div>

        {error && (
          <div style={{ color: '#C62828', padding: 16, background: '#FFEBEE', borderRadius: 8, marginBottom: 16 }}>
            Error: {error}
          </div>
        )}

        {loading && <div className="loading">Loading customers…</div>}

        {!loading && !error && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: 16 }}>
              Top Customers by Revenue
            </div>

            {sorted.length === 0 ? (
              <div className="loading" style={{ height: 400 }}>
                No data for the selected dates
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={thStyle} onClick={() => handleSort('name')}>Name{sortIcon('name')}</th>
                    <th style={thStyle} onClick={() => handleSort('city')}>City{sortIcon('city')}</th>
                    <th style={thStyle} onClick={() => handleSort('state')}>State{sortIcon('state')}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('total_orders')}>Orders{sortIcon('total_orders')}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('total_spent')}>Total Spent{sortIcon('total_spent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, i) => (
                    <tr key={c.customer_id}
                        style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}>
                      <td style={tdStyle}>{c.name}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{c.city}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{c.state}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{c.total_orders.toLocaleString('en-US')}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(c.total_spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
