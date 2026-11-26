import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Avatar from './Avatar';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import './Testimonials.css';

const ROTATE_MS = 7000;

function Stars({ value }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={18} aria-hidden="true" fill={n <= value ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

// Client reviews shown above the footer on every page. Only approved reviews appear; they rotate on their own.
export default function Testimonials({ session, onSignIn }) {
  const { pathname } = useLocation();
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [wantsToWrite, setWantsToWrite] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    api('/testimonials')
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  // Rotate every few seconds (not for people who asked their device to reduce motion).
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (items.length < 2 || paused || reduce) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length, paused]);

  // Signed out visitor pressed "Write a review": open the form once they have signed in.
  useEffect(() => {
    if (!session) {
      setFormOpen(false);
    } else if (wantsToWrite) {
      setFormOpen(true);
      setWantsToWrite(false);
    }
  }, [session, wantsToWrite]);

  if (pathname.startsWith('/admin')) return null;

  function openForm() {
    if (!session) {
      setWantsToWrite(true);
      onSignIn();
      return;
    }
    setThanks(false);
    setFormOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text.trim(), rating }),
      });
      setText('');
      setRating(5);
      setFormOpen(false);
      setThanks(true);
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  const current = items[index % Math.max(items.length, 1)];

  return (
    <section className="testimonials" aria-labelledby="testimonials-title">
      <div className="testimonials-inner">
        <h2 id="testimonials-title">What clients say</h2>

        {current ? (
          <div
            className="testimonial"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <Stars value={current.rating} />
            <blockquote key={current.id}>“{current.body}”</blockquote>
            <div className="testimonial-author">
              <Avatar name={current.author_name} url={current.author_avatar} size={40} />
              <strong>{current.author_name}</strong>
            </div>

            {items.length > 1 && (
              <div className="testimonial-nav">
                <button type="button" aria-label="Previous review" onClick={() => setIndex((index - 1 + items.length) % items.length)}>
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span className="dots">
                  {items.map((item, position) => (
                    <button
                      key={item.id}
                      type="button"
                      className={position === index % items.length ? 'dot active' : 'dot'}
                      aria-label={`Show review ${position + 1}`}
                      onClick={() => setIndex(position)}
                    />
                  ))}
                </span>
                <button type="button" aria-label="Next review" onClick={() => setIndex((index + 1) % items.length)}>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="testimonials-empty">No reviews yet. Be the first to share your experience.</p>
        )}

        {thanks && <div className="notice success">Thank you! Your review will appear after it has been approved.</div>}

        {!formOpen && (
          <button type="button" className="button button-outline" onClick={openForm}>Write a review</button>
        )}

        {formOpen && (
          <form className="review-form" onSubmit={submit}>
            <fieldset>
              <legend>Your rating</legend>
              <div className="rating-pick">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    aria-pressed={rating === n}
                    onClick={() => setRating(n)}
                    className={n <= rating ? 'on' : ''}
                  >
                    <Star size={26} aria-hidden="true" fill={n <= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="review-text">Your review</label>
            <textarea
              id="review-text"
              rows={4}
              minLength={10}
              maxLength={600}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Tell us about your experience (at least 10 characters)"
              required
            />
            {error && <div className="notice error">{error}</div>}
            <div className="review-actions">
              <button type="submit" className="button button-outline" disabled={busy || text.trim().length < 10}>
                {busy ? 'Sending…' : 'Submit review'}
              </button>
              <button type="button" className="button button-outline" onClick={() => setFormOpen(false)} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
