import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';

// The signed-in user's saved projects.
export default function Favorites({ session, onSignIn }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = session?.access_token;

  useEffect(() => {
    let ignore = false;
    if (!token) {
      setLoading(false);
      setProjects([]);
      return undefined;
    }
    setLoading(true);
    api('/favorites')
      .then((data) => {
        if (!ignore) setProjects(data);
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
  }, [token]);

  async function remove(id) {
    try {
      await api(`/projects/${id}/favorite`, { method: 'DELETE' });
      setProjects((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  if (!session) {
    return (
      <div className="page">
        <div className="state empty">
          <h1>My favourites</h1>
          <p>Sign in to see the projects you have saved.</p>
          <button type="button" className="button button-dark" onClick={onSignIn}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>My favourites</h1>
        <p>Projects you saved. Open any project and press the heart to add or remove it.</p>
      </header>

      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading your favourites…</p>}

      {!loading && projects.length === 0 && !error && (
        <div className="state empty">
          <h2>No favourites yet</h2>
          <p>Browse the properties and save the ones you like.</p>
          <Link to="/properties" className="button button-dark">Browse properties</Link>
        </div>
      )}

      {projects.length > 0 && (
        <div className="project-grid">
          {projects.map((project) => (
            <div key={project.id}>
              <ProjectCard project={project} />
              <button type="button" className="link-button" onClick={() => remove(project.id)}>
                Remove from favourites
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
