import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { SITE } from '../lib/site';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <p className="footer-brand">{SITE.name}</p>
          <p className="footer-note">{SITE.role}</p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/properties">Properties</Link>
          <Link to="/new-projects">New Project</Link>
          <Link to="/completed-projects">Completed Project</Link>
          <Link to="/about">About Me</Link>
        </nav>
        <div className="footer-nav">
          <a href={`mailto:${SITE.email}`}><Mail size={16} aria-hidden="true" /> {SITE.email}</a>
          <a href={`tel:${SITE.phone.replace(/[\s-]/g, '')}`}><Phone size={16} aria-hidden="true" /> {SITE.phone}</a>
        </div>
      </div>
      <p className="footer-legal">© {new Date().getFullYear()} {SITE.name}</p>
    </footer>
  );
}
