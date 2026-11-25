import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { SITE } from '../lib/site';
import WhatsAppIcon from './WhatsAppIcon';

const whatsappLink = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappMessage)}`;

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
          <a href={`tel:${SITE.phone.replace(/[\s-]/g, '')}`}>
            <Phone size={16} aria-hidden="true" /> Call {SITE.phone}
          </a>
          <a href={whatsappLink} target="_blank" rel="noreferrer">
            <WhatsAppIcon size={16} /> WhatsApp {SITE.phone}
          </a>
        </div>
      </div>
      <p className="footer-legal">© {new Date().getFullYear()} {SITE.name}</p>
    </footer>
  );
}
