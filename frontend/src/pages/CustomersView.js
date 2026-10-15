/**
 * CustomersView.js — Customer List page
 *
 * This page shows:
 *   - A sortable table of the top customers by revenue (20 by default; 10/20/50/100/All via dropdown)
 *   - Columns: Name | City | State | Orders | Total Spent
 *   - A date range filter
 *
 * The data fetching is already wired up.
 * Your job: implement the UI and the sorting logic.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

// "How many top customers" dropdown options — 0 means all customers
const LIMIT_OPTIONS = [
  { value: 10,  label: '10'  },
  { value: 20,  label: '20'  },
  { value: 50,  label: '50'  },
  { value: 100, label: '100' },
  { value: 0,   label: 'All' },
];

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
  const navigate = useNavigate();
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [customers,  setCustomers]  = useState([]);
  const [limit,      setLimit]      = useState(20);
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

  async function loadData(start = startDate, end = endDate, top = limit) {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers(start, end, top);
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Changing the dropdown reloads straight away, using the dates currently applied
  function handleLimitChange(e) {
    const top = Number(e.target.value);
    setLimit(top);
    loadData(startDate, endDate, top);
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
        </div>

        {error && (
          <div style={{ color: '#C62828', padding: 16, background: '#FFEBEE', borderRadius: 8, marginBottom: 16 }}>
            Error: {error}
          </div>
        )}

        {loading && <div className="loading">Loading customers…</div>}

        {!loading && !error && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div className="section-title">Top Customers by Revenue</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Show
                <select value={limit} onChange={handleLimitChange}
                  style={{
                    background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                  }}>
                  {LIMIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                customers
              </label>
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
                        onClick={() => navigate(`/customers/${c.customer_id}`)}
                        title="View order and address history"
                        style={{ cursor: 'pointer', background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' }}>
                      <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 600 }}>{c.name}</td>
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
