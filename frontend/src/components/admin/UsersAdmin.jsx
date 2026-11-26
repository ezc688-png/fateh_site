import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { friendlyError } from '../../lib/format';

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ROLES = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'user', label: 'User' },
  { value: 'banned', label: 'Banned' },
];

// Change anyone's role from the live site. Emails in ADMIN_EMAILS on the server are protected (locked).
export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState(null);

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

  async function changeRole(user, role) {
    setSavingId(user.id);
    setError('');
    setMessage('');
    try {
      await api(`/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, role } : item)));
      setMessage(`${user.email} is now: ${ROLES.find((r) => r.value === role).label}.`);
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section aria-label="Users">
      <div className="admin-toolbar">
        <h2>Users ({users.length})</h2>
      </div>
      <p className="muted">
        <strong>Administrator</strong> can manage the whole site. <strong>User</strong> can comment, review and save
        favourites. <strong>Banned</strong> can only browse. Locked accounts are set in the server settings and cannot be
        changed here, and you cannot change your own role.
      </p>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading users…</p>}

      {users.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Name">{user.display_name || '-'}</td>
                  <td data-label="Role">
                    {user.locked ? (
                      <span className="role-badge is-admin">Administrator (locked)</span>
                    ) : (
                      <select
                        className="role-select"
                        value={user.role}
                        disabled={savingId === user.id}
                        onChange={(event) => changeRole(user, event.target.value)}
                        aria-label={`Role for ${user.email}`}
                      >
                        {ROLES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    )}
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
