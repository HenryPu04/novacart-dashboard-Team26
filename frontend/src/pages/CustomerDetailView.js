/**
 * CustomerDetailView.js — Customer Detail page (stretch goal OPT-02)
 *
 * Opened by clicking a customer in the Customer List. This page shows:
 *   - Customer profile and stat cards (orders, total spent, addresses on record)
 *   - Address history — every dim_customer row for the customer (SCD Type 2)
 *   - Full order history — every order, all statuses, newest first
 *
 * Data comes from GET /franchise/customers/{customer_id}/history.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getCustomerHistory } from '../utils/api';

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// SCD Type 2 rows that are still open use 9999-12-31 as valid_to
function formatValidTo(value) {
  return String(value).startsWith('9999') ? 'Present' : value;
}

// Status badge colours — translucent so they work in light and dark mode
const STATUS_COLORS = {
  delivered: '#00897B',
  shipped:   '#1E88E5',
  pending:   '#F9A825',
  cancelled: '#78909C',
  returned:  '#E53935',
};

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#78909C';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
      color, background: `${color}22`, border: `1px solid ${color}55`,
    }}>
      {status}
    </span>
  );
}

// Table cell styles — use theme variables so the tables follow dark mode
const thStyle = {
  textAlign: 'left', padding: '10px 12px',
  fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
  color: 'var(--text-muted)', borderBottom: '2px solid var(--border)',
  position: 'sticky', top: 0, background: 'var(--bg-card)',
};
const tdStyle = {
  padding: '10px 12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
};
const rowStyle = i => ({ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-primary)' });

export default function CustomerDetailView() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        setCustomer(await getCustomerHistory(customerId));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [customerId]);

  const current = customer?.addresses.find(a => a.is_current);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="page">

        <button className="btn-apply" style={{ marginBottom: 20 }} onClick={() => navigate('/customers')}>
          ← Back to Customers
        </button>

        {error && (
          <div style={{ color: '#C62828', padding: 16, background: '#FFEBEE', borderRadius: 8, marginBottom: 16 }}>
            Error: {error}
          </div>
        )}

        {loading && <div className="loading">Loading customer…</div>}

        {!loading && !error && customer && (
          <>
            {/* Profile header */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div className="section-title" style={{ fontSize: 22 }}>{customer.name}</div>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{customer.customer_id}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <span>{customer.email}</span>
                <span>Customer since {customer.signup_date}</span>
                {current && <span>{current.city}, {current.state}</span>}
              </div>
            </div>

            {/* Stat cards */}
            <div className="stat-row">
              <div className="stat-box">
                <div className="label">Total Orders</div>
                <div className="value">{customer.total_orders.toLocaleString('en-US')}</div>
              </div>
              <div className="stat-box">
                <div className="label">Total Spent</div>
                <div className="value">{formatCurrency(customer.total_spent)}</div>
              </div>
              <div className="stat-box">
                <div className="label">Addresses on Record</div>
                <div className="value">{customer.addresses.length}</div>
              </div>
            </div>

            {/* Address history (SCD Type 2) */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Address History</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Street</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>State</th>
                    <th style={thStyle}>ZIP</th>
                    <th style={thStyle}>Valid From</th>
                    <th style={thStyle}>Valid To</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.addresses.map((a, i) => (
                    <tr key={`${a.valid_from}-${i}`} style={rowStyle(i)}>
                      <td style={{ ...tdStyle, fontWeight: a.is_current ? 600 : 400 }}>{a.street}</td>
                      <td style={tdStyle}>{a.city}</td>
                      <td style={tdStyle}>{a.state}</td>
                      <td style={tdStyle}>{a.zip}</td>
                      <td style={tdStyle}>{a.valid_from}</td>
                      <td style={tdStyle}>
                        {formatValidTo(a.valid_to)}
                        {a.is_current && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>CURRENT</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Full order history */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>
                Order History
                <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>
                  {customer.orders.length} orders, newest first
                </span>
              </div>
              {customer.orders.length === 0 ? (
                <div className="loading">This customer has no orders yet</div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Order ID</th>
                        <th style={thStyle}>Product</th>
                        <th style={thStyle}>Category</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                        <th style={thStyle}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders.map((o, i) => (
                        <tr key={o.order_id} style={rowStyle(i)}>
                          <td style={tdStyle}>{o.order_date}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{o.order_id}</td>
                          <td style={tdStyle}>{o.product_name}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{o.category}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{o.quantity}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(o.amount)}</td>
                          <td style={tdStyle}><StatusBadge status={o.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
