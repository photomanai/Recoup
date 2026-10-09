import { Link } from 'react-router-dom';

const SAAS = [
  { name: 'Cloudflare', desc: 'Uptime + performance. Live SLA tracking with claim emails.', on: true },
  { name: 'AWS', desc: 'Cost + SLA guard. Coming soon.', on: false },
  { name: 'Twilio', desc: 'Latency + delivery claims. Coming soon.', on: false },
  { name: 'Zendesk', desc: 'Support SLA tracking. Coming soon.', on: false },
  { name: 'Salesforce', desc: 'Uptime credits. Coming soon.', on: false },
];

export default function Landing() {
  return (
    <div className="wrap">
      <nav className="nav">
        <div className="logo">
          Recoup<span>.</span>
        </div>
        <div>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      </nav>
      <section className="hero">
        <span className="eyebrow">RECOUP • CLOUDFLARE MVP LIVE</span>
        <h1>
          Stop overpaying SaaS. <span className="accent">Reclaim SLA credits.</span>
        </h1>
        <p className="sub">
          Vendors promise 100% uptime with service credits — but claims are never automatic. We
          monitor Cloudflare 24/7, detect refundable violations, and email both you and the vendor
          with a ready-to-file claim.
        </p>
        <div className="cta-row">
          <Link className="btn" to="/register">
            Register company
          </Link>
          <Link className="btn ghost" to="/login">
            Open dashboard
          </Link>
        </div>
      </section>
      <section className="grid">
        {SAAS.map((s) => (
          <div key={s.name} className={s.on ? 'card active' : 'card'}>
            <span className={s.on ? 'pill on' : 'pill off'}>{s.on ? 'ACTIVE' : 'SOON'}</span>
            <h3>
              {s.on && <span className="dot live" />}
              {!s.on && <span className="dot dead" style={{ opacity: 0.3 }} />}
              {s.name}
            </h3>
            <p>{s.desc}</p>
          </div>
        ))}
      </section>
      <section className="panel">
        <strong>How it works for judges</strong>
        <p className="sub" style={{ fontSize: 14 }}>
          1. Register with company + Gmail App Password → 2. Activate Cloudflare → 3. Click
          “Simulate Outage” → 4. Watch the incident, estimated refund, and two claim emails fire.
          Real Cloudflare rule: 100% uptime, claim within 5 business days, proportional credit.
          Latency &gt;200ms is a custom demo rule.
        </p>
      </section>
    </div>
  );
}
