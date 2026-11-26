import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import './EnquiryForm.css';

// "Request a viewing" pop-up. Anyone can send it; if they are signed in their details are filled in for them.
export default function EnquiryForm({ projectId, projectName, session, me, onClose }) {
  const [form, setForm] = useState({
    name: me?.display_name || '',
    phone: '',
    email: session?.user?.email || '',
    preferred_date: '',
    message: '',
    website: '', // hidden field for bots
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${projectId}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSent(true);
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="enquiry-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="enquiry-dialog" role="dialog" aria-modal="true" aria-labelledby="enquiry-title">
        <button type="button" className="enquiry-close" onClick={onClose} aria-label="Close form">
          <X size={20} aria-hidden="true" />
        </button>

        {sent ? (
          <div className="enquiry-done">
            <h2 id="enquiry-title">Thank you</h2>
            <p>Your request for {projectName} was sent. Fateh will contact you soon.</p>
            <button type="button" className="button button-dark" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="enquiry-title">Request a viewing</h2>
            <p className="enquiry-sub">{projectName}</p>

            <label className="field">
              Your name
              <input value={form.name} onChange={(e) => setField('name', e.target.value)} maxLength={80} required />
            </label>
            <label className="field">
              Phone number
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+60 12-345 6789"
                maxLength={30}
                required
              />
            </label>
            <label className="field">
              Email (optional)
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} maxLength={120} />
            </label>
            <label className="field">
              Preferred date (optional)
              <input type="date" min={today} value={form.preferred_date} onChange={(e) => setField('preferred_date', e.target.value)} />
            </label>
            <label className="field">
              Message (optional)
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setField('message', e.target.value)}
                maxLength={1000}
                placeholder="Anything you would like Fateh to know"
              />
            </label>

            {/* Honeypot: hidden from people, bots fill it in and are ignored. */}
            <input
              className="enquiry-trap"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
            />

            {error && <div className="notice error">{error}</div>}
            <div className="enquiry-actions">
              <button type="submit" className="button button-dark" disabled={busy}>
                {busy ? 'Sending…' : 'Send request'}
              </button>
              <button type="button" className="button button-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
