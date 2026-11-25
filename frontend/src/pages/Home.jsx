import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import { SITE } from '../lib/site';
import WhatsAppIcon from '../components/WhatsAppIcon';

// 6 columns x 9 rows of windows. The lit pattern is fixed so the tower looks the same on every visit.
const WINDOWS = Array.from({ length: 54 }, (_, index) => ({ index, lit: (index * 5) % 7 < 3 }));

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    api('/projects?status=new')
      .then((data) => {
        if (!ignore) setProjects(data.slice(0, 3));
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
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>{SITE.headline}</h1>
          <p>{SITE.intro}</p>
          <div className="hero-actions">
            <Link to="/new-projects" className="button button-dark">View new projects</Link>
            <Link to="/properties" className="button button-light">Browse all properties</Link>
          </div>
        </div>
        <div className="tower" aria-hidden="true">
          {WINDOWS.map((window) => (
            <span
              key={window.index}
              className={`pane${window.lit ? ' lit' : ''}`}
              style={{ '--i': window.index }}
            />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Latest new projects</h2>
          <Link to="/new-projects" className="text-link">See all new projects</Link>
        </div>
        {error && <div className="notice error">{error}</div>}
        {loading && <p className="state">Loading projects…</p>}
        {!loading && !error && projects.length === 0 && (
          <p className="state">No new projects have been added yet.</p>
        )}
        {projects.length > 0 && (
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <section className="contact-strip">
        <div className="contact-inner">
          <div>
            <h2>Want to see a project in person?</h2>
            <p>Send a message and I will arrange a viewing.</p>
          </div>
          <div className="contact-actions">
            <a
              href={`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappMessage)}`}
              className="button button-light"
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon size={18} /> WhatsApp me
            </a>
            <a href={`tel:${SITE.phone.replace(/[\s-]/g, '')}`} className="button button-outline">
              <Phone size={18} aria-hidden="true" /> Call {SITE.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
