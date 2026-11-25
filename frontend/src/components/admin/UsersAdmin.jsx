import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { friendlyError } from '../../lib/format';

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Read-only list. A user is an admin when their email is in ADMIN_EMAILS on the backend.
export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    api('/admin/users')
      .then((data) => {
        if (!ignore) setUsers(data);
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
    <section aria-label="Users">
      <div className="admin-toolbar">
        <h2>Users ({users.length})</h2>
      </div>
      <p className="muted">
        Roles come from the <code>ADMIN_EMAILS</code> setting on the backend. Everyone else is a visitor who can
        only add, edit and delete their own comments.
      </p>

      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading users…</p>}

      {users.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Role">
                    <span className={`role-badge${user.role === 'admin' ? ' is-admin' : ''}`}>
                      {user.role === 'admin' ? 'Admin' : 'Visitor'}
                    </span>
                  </td>
                  <td data-label="Joined">{formatDate(user.created_at)}</td>
                  <td data-label="Last sign-in">{formatDate(user.last_sign_in_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
