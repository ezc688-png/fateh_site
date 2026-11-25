import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { SITE } from '../lib/site';
import WhatsAppIcon from '../components/WhatsAppIcon';

// Opens WhatsApp (app or web) with the message from lib/site.js already typed in.
const whatsappLink = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappMessage)}`;

// Put your photo at frontend/public/about.jpg. Until it exists, the first letter of your name is shown.
export default function About() {
  const [photoMissing, setPhotoMissing] = useState(false);

  return (
    <div className="page about">
      <div className="about-photo">
        {photoMissing ? (
          <span className="about-initial" aria-hidden="true">{SITE.owner.charAt(0)}</span>
        ) : (
          <img src="/about.jpg" alt={SITE.owner} onError={() => setPhotoMissing(true)} />
        )}
      </div>

      <div className="about-copy">
        <h1>{SITE.owner}</h1>
        <p className="about-role">{SITE.role}</p>
        {SITE.bio.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <ul className="contact-list">
          <li>
            <a href={`mailto:${SITE.email}`}>
              <Mail size={18} aria-hidden="true" /> {SITE.email}
            </a>
          </li>
          <li>
            <a href={`tel:${SITE.phone.replace(/[\s-]/g, '')}`}>
              <Phone size={18} aria-hidden="true" /> Call {SITE.phone}
            </a>
          </li>
          <li>
            <a href={whatsappLink} target="_blank" rel="noreferrer">
              <WhatsAppIcon size={18} /> WhatsApp {SITE.phone}
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
