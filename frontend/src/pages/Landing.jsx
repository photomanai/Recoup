import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';

const GITHUB = 'https://github.com/photomanai/Recoup';

const SAAS = [
  { name: 'Cloudflare', desc: 'Uptime + performance. Live SLA tracking with claim emails.', on: true },
  { name: 'AWS', desc: 'Cost + SLA guard. Coming soon.', on: false },
  { name: 'Twilio', desc: 'Latency + delivery claims. Coming soon.', on: false },
  { name: 'Zendesk', desc: 'Support SLA tracking. Coming soon.', on: false },
  { name: 'Salesforce', desc: 'Uptime credits. Coming soon.', on: false },
];

const STEPS = [
  {
    n: '01',
    t: 'Register the company',
    d: 'Company name, login, the AI sender Gmail + App Password, and the monthly Cloudflare fee. Passwords are hashed, App Passwords AES-encrypted.',
  },
  {
    n: '02',
    t: 'Activate Cloudflare',
    d: 'One click on the dashboard. The monitor worker starts checking uptime and latency every few seconds, 24/7.',
  },
  {
    n: '03',
    t: 'Get the refund filed',
    d: 'On a refundable violation the engine opens an incident, estimates the credit, and emails both you and Cloudflare with a ready-to-file claim.',
  },
];

const FEATURES = [
  {
    t: '24/7 violation watch',
    d: 'Every check is stored as a metric. Outages and slowdowns are caught the minute they happen — not at the end of the month.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    t: 'Dual claim emails',
    d: 'One plain-language alert to your team with the estimated refund, one formal claim to the vendor with duration, URLs and deadline.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    t: 'Credit calculator',
    d: 'Outage credit follows Cloudflare’s proportional formula with the 10x multiplier; latency uses a clearly-labeled 15% demo rule.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    t: 'Deadline guard',
    d: 'Every incident carries a claim-by date. Cloudflare only accepts claims within days — Recoup never lets one expire silently.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const FAQS = [
  {
    q: 'What is an SLA credit?',
    a: 'A discount Cloudflare owes you when it misses its 100% uptime promise. It is the sole remedy in the contract — but it is never applied automatically. Somebody has to notice the outage, collect evidence, and file a claim in time.',
  },
  {
    q: 'Why doesn’t Cloudflare just refund me?',
    a: 'Because the SLA is claim-based by design: you must report the incident within 5 business days and submit traceroutes, affected URLs and duration before the end of the next billing month. No claim, no credit — that is exactly the gap Recoup closes.',
  },
  {
    q: 'Which violations trigger a refund in Recoup?',
    a: 'Two. An outage (uptime drops to 0) opens an incident immediately and the credit is estimated with Cloudflare’s proportional formula plus the 10x multiplier. A latency average above 200ms across 5 checks triggers a 15% demo-rule credit — honestly labeled as custom, since the real SLA has no latency clause.',
  },
  {
    q: 'Where do the claim emails go?',
    a: 'Two places at once. Your team gets a plain-language alert with the estimated refund and the claim deadline. The vendor gets a formal claim email with incident type, duration, affected domain and deadline. In log mode they are recorded in the dashboard instead of sent.',
  },
  {
    q: 'Is my Gmail App Password safe?',
    a: 'Login passwords are bcrypt-hashed and the Gmail App Password is AES-256 encrypted before storage. It is never returned by the API and is only decrypted in memory at the moment an email is sent. Use a dedicated sender Gmail, not your personal inbox.',
  },
  {
    q: 'What does the MVP not do yet?',
    a: 'Metrics are simulated rather than polled from the live Cloudflare API, only Cloudflare is active (AWS, Twilio, Zendesk and Salesforce are parked as “Soon”), and no money moves automatically — Recoup files the claim, the credit itself still comes from the vendor.',
  },
];

function Counter({ to, suffix = '' }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min((t - t0) / 1200, 1);
          setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref} className="mono">
      {val}
      {suffix}
    </span>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq ${open ? 'open' : ''}`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
      <div className="faq-body" aria-hidden={!open}>
        <p>{a}</p>
      </div>
    </div>
  );
}

function HeroVisual() {
  const ref = useRef(null);
  function tilt(e) {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
  }
  function flat() {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  }
  return (
    <div className="hero-visual" onMouseMove={tilt} onMouseLeave={flat} ref={ref}>
      <div className="hv-card hv-main">
        <div className="hv-head">
          <span className="dot live" /> Cloudflare · live
          <span className="hv-up mono">100%</span>
        </div>
        <svg viewBox="0 0 300 110" className="hv-chart" aria-hidden="true">
          <line x1="0" y1="78" x2="300" y2="78" className="hv-rule" />
          <text x="6" y="72" className="hv-label">200ms</text>
          <path
            className="hv-line"
            d="M0,95 L30,88 L60,92 L90,84 L120,90 L150,60 L180,34 L210,44 L240,30 L270,52 L300,40"
          />
          <circle cx="240" cy="30" r="4" className="hv-spike" />
        </svg>
        <div className="hv-foot mono">latency · last 40 checks</div>
      </div>
      <div className="hv-card hv-alert">
        <strong>Latency violation</strong>
        <span className="mono">avg 342ms · credit $30.00</span>
      </div>
      <div className="hv-card hv-mail">
        <strong>2 claim emails sent</strong>
        <span>your team + Cloudflare support</span>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link to="/" className="logo">
            Recoup<span>.</span>
          </Link>
          <nav className="top-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="top-cta">
            <a className="gh" href={GITHUB} target="_blank" rel="noreferrer" aria-label="Recoup on GitHub">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
              </svg>
              GitHub
            </a>
            <Link to="/login" className="quiet">Login</Link>
            <Link to="/register" className="btn small">Register</Link>
          </div>
        </div>
      </header>

      <div className="wrap">
        <section className="hero hero-split">
          <div>
            <span className="eyebrow">RECOUP • CLOUDFLARE MVP LIVE</span>
            <h1>
              Stop overpaying SaaS. <span className="accent">Reclaim SLA credits.</span>
            </h1>
            <p className="sub">
              Vendors promise 100% uptime with service credits — but claims are never automatic.
              We monitor Cloudflare 24/7, detect refundable violations, and email both you and
              the vendor with a ready-to-file claim.
            </p>
            <div className="cta-row">
              <Link className="btn" to="/register">Register company</Link>
              <Link className="btn ghost" to="/login">Open dashboard</Link>
            </div>
            <div className="hero-stats">
              <div><Counter to={100} suffix="%" /><span>uptime target tracked</span></div>
              <div><Counter to={2} /><span>claim emails per violation</span></div>
              <div><Counter to={5} /><span>day claim window guarded</span></div>
            </div>
          </div>
          <HeroVisual />
        </section>

        <Reveal>
          <div className="marquee" aria-hidden="true">
            <div className="marquee-track">
              {['Cloudflare ● live', 'AWS ○ soon', 'Twilio ○ soon', 'Zendesk ○ soon', 'Salesforce ○ soon',
                'Cloudflare ● live', 'AWS ○ soon', 'Twilio ○ soon', 'Zendesk ○ soon', 'Salesforce ○ soon'].map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
          </div>
        </Reveal>

        <section id="how" className="section">
          <Reveal>
            <p className="kicker">How it works</p>
            <h2>Three steps to money back.</h2>
          </Reveal>
          <div className="steps">
            <img src="/img/datacenter.jpg" alt="Cloud datacenter corridor" loading="lazy" />
            <div>
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 60}>
                  <div className="step">
                    <span className="step-n mono">{s.n}</span>
                    <div>
                      <h3>{s.t}</h3>
                      <p>{s.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="section">
          <Reveal>
            <p className="kicker">Why Recoup</p>
            <h2>Built for the claim nobody files.</h2>
          </Reveal>
          <div className="feat-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={i * 60}>
                <div className="feat">
                  <span className="feat-ic">{f.icon}</span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="split">
              <div>
                <h3>Evidence, packaged like a claim.</h3>
                <p>
                  Every incident ships with what Cloudflare support actually asks for: incident
                  type, duration, affected domain, and the claim deadline. Your finance team sees
                  dollars, support sees facts — nobody chases logs at month end.
                </p>
                <Link className="btn small dark" to="/register">Start reclaiming</Link>
              </div>
              <img src="/img/security.jpg" alt="Security operations" loading="lazy" />
            </div>
          </Reveal>
        </section>

        <section className="section">
          <Reveal>
            <p className="kicker">Coverage</p>
            <h2>Cloudflare live. More vendors soon.</h2>
          </Reveal>
          <div className="grid">
            {SAAS.map((s, i) => (
              <Reveal key={s.name} delay={i * 50}>
                <div className={s.on ? 'card active' : 'card'}>
                  <span className={s.on ? 'pill on' : 'pill off'}>{s.on ? 'ACTIVE' : 'SOON'}</span>
                  <h3>
                    {s.on && <span className="dot live" />}
                    {!s.on && <span className="dot dead" style={{ opacity: 0.3 }} />}
                    {s.name}
                  </h3>
                  <p>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="faq" className="section">
          <Reveal>
            <p className="kicker">FAQ</p>
            <h2>Questions judges always ask.</h2>
          </Reveal>
          <div className="faq-list">
            {FAQS.map((f) => (
              <Reveal key={f.q}>
                <FaqItem q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </section>

        <section id="contact" className="section">
          <Reveal>
            <p className="kicker">Contact</p>
            <h2>Talk to us.</h2>
          </Reveal>
          <div className="contact-grid">
            <Reveal>
              <a className="contact-card" href="mailto:hello@recoup.app?subject=Recoup%20question">
                <span className="feat-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3>Email</h3>
                <p>hello@recoup.app — we reply within a day.</p>
              </a>
            </Reveal>
            <Reveal delay={70}>
              <a className="contact-card" href={GITHUB} target="_blank" rel="noreferrer">
                <span className="feat-ic">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
                  </svg>
                </span>
                <h3>GitHub</h3>
                <p>github.com/photomanai/Recoup — star, fork, file issues.</p>
              </a>
            </Reveal>
          </div>
        </section>
      </div>

      <footer className="footer">
        <div className="wrap footer-in">
          <Link to="/" className="logo">Recoup<span>.</span></Link>
          <p>Reclaim what your uptime already paid for. MVP — metrics simulated, claims real.</p>
          <div className="foot-links">
            <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
            <a href="#faq">FAQ</a>
            <a href="#contact">Contact</a>
            <Link to="/register">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
