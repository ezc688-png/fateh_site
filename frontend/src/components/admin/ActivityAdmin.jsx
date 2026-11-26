import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { friendlyError } from '../../lib/format';

function formatTime(value) {
  return new Date(value).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Read-only record of admin actions: who did what and when.
export default function ActivityAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    api('/admin/activity')
      .then((data) => {
        if (!ignore) setRows(data);
      })
      .catch((err) => {
        if (!ignore) setError(friendlyError(err.message));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section aria-label="Activity log">
      <div className="admin-toolbar">
        <h2>Activity log</h2>
      </div>
      <p className="muted">The latest 300 actions. This list is read-only.</p>
      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading activity…</p>}
      {!loading && rows.length === 0 && !error && <p className="state">Nothing recorded yet.</p>}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="When">{formatTime(row.created_at)}</td>
                  <td data-label="Who">{row.actor}</td>
                  <td data-label="Action">{row.action}</td>
                  <td data-label="Item">{row.target}</td>
                  <td data-label="Details">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
