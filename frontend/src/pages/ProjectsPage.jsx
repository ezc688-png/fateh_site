import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'condominium', label: 'Condominium' },
  { value: 'landed', label: 'Landed' },
];

// One page for /properties, /new-projects and /completed-projects.
// `status` limits the list to new or completed projects; the category lives in the address (?category=landed).
export default function ProjectsPage({ status, title, intro }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('category');
  const category = CATEGORIES.some((item) => item.value === requested) ? requested : 'all';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (category !== 'all') query.set('category', category);
    const queryString = query.toString();

    setLoading(true);
    setError('');
    api(`/projects${queryString ? `?${queryString}` : ''}`)
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
  }, [status, category]);

  function pick(value) {
    setParams(value === 'all' ? {} : { category: value });
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>

      <div className="filter-bar" role="group" aria-label="Filter by category">
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`chip${category === item.value ? ' active' : ''}`}
            aria-pressed={category === item.value}
            onClick={() => pick(item.value)}
          >
            {item.label}
          </button>
        ))}
        {!loading && !error && (
          <span className="result-count">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        )}
      </div>

      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading projects…</p>}

      {!loading && !error && projects.length === 0 && (
        <div className="state empty">
          <h2>No projects in this category yet</h2>
          <p>Pick another category above to see more.</p>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="project-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
