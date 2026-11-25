import { useCallback, useEffect, useState } from 'react';
import CommentsAdmin from '../components/admin/CommentsAdmin';
import ProjectsAdmin from '../components/admin/ProjectsAdmin';
import UsersAdmin from '../components/admin/UsersAdmin';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import './Admin.css';

const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'comments', label: 'Comments' },
  { id: 'users', label: 'Users' },
];

export default function Admin({ session, onSignIn }) {
  // access: 'checking' | 'yes' | 'no'. The backend decides; this page only reacts to its answer.
  const [access, setAccess] = useState('checking');
  const [tab, setTab] = useState('projects');
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const token = session?.access_token;

  useEffect(() => {
    let ignore = false;
    setAccess('checking');
    api('/me')
      .then((data) => {
        if (!ignore) setAccess(data.is_admin ? 'yes' : 'no');
      })
      .catch(() => {
        if (!ignore) setAccess('no');
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  // Dashboard tiles. Called again after any change so the numbers stay correct.
  const loadStats = useCallback(() => {
    api('/admin/stats')
      .then((data) => {
        setStats(data);
        setStatsError('');
      })
      .catch((err) => setStatsError(friendlyError(err.message)));
  }, []);

  useEffect(() => {
    if (access === 'yes') loadStats();
  }, [access, loadStats]);

  if (access === 'checking') {
    return (
      <div className="page">
        <p className="state">Checking access…</p>
      </div>
    );
  }

  if (access === 'no') {
    return (
      <div className="page">
        <div className="state empty">
          <h1>Admin only</h1>
          {session ? (
            <p>This account does not have admin access.</p>
          ) : (
            <>
              <p>Sign in with the owner account to manage the site.</p>
              <button type="button" className="button button-dark" onClick={onSignIn}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page admin">
      <div className="page-head">
        <h1>Admin</h1>
        <p>Manage projects, comments and users.</p>
      </div>

      {statsError && <div className="notice error">{statsError}</div>}
      {stats && (
        <div className="stat-tiles">
          <div className="stat-tile">
            <span className="stat-number">{stats.projects}</span>
            <span className="stat-label">Projects</span>
          </div>
          <div className="stat-tile">
            <span className="stat-number">
              {stats.new_projects} / {stats.completed_projects}
            </span>
            <span className="stat-label">New / Completed</span>
          </div>
          <div className="stat-tile">
            <span className="stat-number">{stats.comments}</span>
            <span className="stat-label">Comments</span>
          </div>
          <div className="stat-tile">
            <span className="stat-number">{stats.users}</span>
            <span className="stat-label">Users</span>
          </div>
        </div>
      )}

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`admin-tab${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'projects' && <ProjectsAdmin onChanged={loadStats} />}
      {tab === 'comments' && <CommentsAdmin onChanged={loadStats} />}
      {tab === 'users' && <UsersAdmin />}
    </div>
  );
}
