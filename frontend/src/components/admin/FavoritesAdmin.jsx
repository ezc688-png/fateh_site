import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { friendlyError } from '../../lib/format';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Who saved which project: useful for following up with people who have not sent a request.
export default function FavoritesAdmin() {
  const [data, setData] = useState({ by_project: [], recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    api('/admin/favorites')
      .then((result) => {
        if (!ignore) setData(result);
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
    <section aria-label="Favourites">
      <div className="admin-toolbar">
        <h2>Favourites</h2>
      </div>
      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading favourites…</p>}
      {!loading && data.recent.length === 0 && !error && <p className="state">Nobody has saved a project yet.</p>}

      {data.recent.length > 0 && (
        <div className="admin-two-col">
          <div>
            <h3>Most saved projects</h3>
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr><th>Project</th><th>Saves</th></tr></thead>
                <tbody>
                  {data.by_project.map((row) => (
                    <tr key={row.project_id}>
                      <td data-label="Project">{row.name}</td>
                      <td data-label="Saves">{row.saves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3>Who saved what</h3>
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr><th>User</th><th>Email</th><th>Project</th><th>Saved</th></tr></thead>
                <tbody>
                  {data.recent.map((row, position) => (
                    <tr key={`${row.email}-${row.project_name}-${position}`}>
                      <td data-label="User">{row.display_name || row.email.split('@')[0]}</td>
                      <td data-label="Email">{row.email}</td>
                      <td data-label="Project">{row.project_name}</td>
                      <td data-label="Saved">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
