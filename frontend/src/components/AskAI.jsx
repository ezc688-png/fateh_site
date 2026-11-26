import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api';
import './AskAI.css';

const SUGGESTIONS = [
  'Which projects are new launches?',
  'Show me penthouses',
  'What is available in Bangsar?',
];

// Floating "Ask AI" button (bottom right) that opens a small chat panel.
export default function AskAI() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]); // { role: 'user' | 'ai' | 'error', text, projects? }
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(text) {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((current) => [...current, { role: 'user', text: clean }]);
    setQuestion('');
    setBusy(true);
    try {
      const result = await api('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: clean }),
      });
      setMessages((current) => [...current, { role: 'ai', text: result.answer, projects: result.projects }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'error', text: error.message || 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section className="ask-panel" role="dialog" aria-label="Ask AI about our properties">
          <header className="ask-head">
            <strong>Ask AI</strong>
            <button type="button" className="ask-x" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="ask-body">
            {messages.length === 0 && (
              <>
                <p className="ask-hint">Ask about our projects, areas, sizes or prices.</p>
                <div className="ask-chips">
                  {SUGGESTIONS.map((text) => (
                    <button key={text} type="button" onClick={() => send(text)}>{text}</button>
                  ))}
                </div>
              </>
            )}

            {messages.map((message, index) => (
              <div key={index} className={`ask-msg ask-${message.role}`}>
                <p>{message.text}</p>
                {message.projects?.length > 0 && (
                  <div className="ask-links">
                    {message.projects.map((project) => (
                      <Link key={project.id} to={`/projects/${project.id}`} onClick={() => setOpen(false)}>
                        View {project.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="ask-msg ask-ai"><p>Thinking…</p></div>}
            <div ref={bottom} />
          </div>

          <form
            className="ask-form"
            onSubmit={(event) => {
              event.preventDefault();
              send(question);
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Type your question"
              maxLength={500}
              aria-label="Your question"
            />
            <button type="submit" disabled={busy || !question.trim()} aria-label="Send question">
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      {!open && (
        <button type="button" className="ask-fab" onClick={() => setOpen(true)}>
          <Sparkles size={18} aria-hidden="true" />
          Ask AI
        </button>
      )}
    </>
  );
}
