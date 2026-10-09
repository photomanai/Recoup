import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import api from '../api';
import Reveal from '../components/Reveal';
import Counter from '../components/Counter';

const GITHUB = 'https://github.com/photomanai/Recoup';

export default function Dashboard() {
  const nav = useNavigate();
  const companyId = localStorage.getItem('companyId');
  const [data, setData] = useState({ metrics: [], incidents: [], notifications: [], saas: [], totalCredit: 0 });
  const [mode, setMode] = useState('normal');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const { data: d } = await api.get(`/dashboard/${companyId}`);
      setData(d);
    } catch {
      setMsg('Failed to load dashboard');
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activate() {
    await api.post('/saas/cloudflare/activate', { zoneInfo: { domain: 'example.com' } });
    setMsg('Cloudflare activated — monitoring every few seconds');
    load();
  }

  async function simulate(m) {
    const { data: d } = await api.post(`/simulate/${m}`);
    setMode(d.mode);
    setMsg(m === 'recover' ? 'Recovered to normal' : `Scenario running: ${m}`);
    setTimeout(load, 1500);
  }

  function logout() {
    localStorage.clear();
    nav('/');
  }

  const cf = data.saas.find((s) => s.provider === 'cloudflare');
  const active = cf?.status === 'active';
  const last = data.metrics[data.metrics.length - 1];
  const lat = last ? last.latency_ms : 0;
  const down = last ? last.uptime === 0 : false;
  const chart = data.metrics.slice(-40).map((m) => ({
    t: new Date(m.ts).toLocaleTimeString(),
    ms: m.latency_ms,
  }));
  const openCount = data.incidents.filter((i) => i.status === 'open').length;

  return (
    <div className="landing">
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link to="/" className="logo">
            Recoup<span>.</span>
          </Link>
          <nav className="top-links">
            <Link to="/">Home</Link>
            <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <div className="top-cta">
            <button className="btn small ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="wrap">
        <section className="dash-head">
          <Reveal>
            <p className="kicker">Mission control</p>
            <h1>Cloudflare watch<span className="accent">.</span></h1>
          </Reveal>
          <Reveal delay={80}>
            <div className={active ? 'ops-hero on' : 'ops-hero'}>
              <div>
                <span className={active ? 'pill on' : 'pill off'}>
                  {active ? 'MONITORED 24/7' : 'PAUSED'}
                </span>
                <h2>
                  {active && <span className="dot live" />}
                  {!active && <span className="dot dead" />}
                  Cloudflare
                </h2>
                <p>
                  {active
                    ? 'Every check is scored against the SLA. Violations open incidents and fire both claim emails automatically.'
                    : 'Activate monitoring to start scoring uptime and latency against the SLA.'}
                </p>
              </div>
              <div className="ops-side">
                <div className="ops-num mono">{data.metrics.length}</div>
                <span>checks recorded</span>
                {!active && (
                  <button className="btn" onClick={activate}>
                    Activate Cloudflare
                  </button>
                )}
              </div>
            </div>
          </Reveal>
          {msg && <p className="dash-msg">{msg}</p>}
        </section>

        <div className="stats stats-dash">
          <Reveal>
            <div className="stat">
              <div className="k">UPTIME NOW</div>
              <div className={down ? 'v bad' : 'v good'}>
                {last ? (down ? '0%' : '100%') : '—'}
              </div>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <div className="stat">
              <div className="k">LAST LATENCY</div>
              <div className={lat > 200 ? 'v bad' : 'v good'}>
                <Counter to={lat} suffix=" ms" />
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="stat">
              <div className="k">EST. REFUND (MONTH)</div>
              <div className="v good">
                <Counter to={Number(data.totalCredit) || 0} prefix="$" decimals={2} />
              </div>
            </div>
          </Reveal>
          <Reveal delay={180}>
            <div className="stat">
              <div className="k">OPEN INCIDENTS</div>
              <div className={openCount ? 'v bad' : 'v good'}>
                <Counter to={openCount} />
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="panel">
            <div className="panel-head">
              <div>
                <strong>Latency radar</strong>
                <p>Last 40 checks · Demo rule: over 200ms is refundable</p>
              </div>
              <span className={`tag ${mode}`}>{mode}</span>
            </div>
            <div style={{ height: 230 }}>
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6ba1bc" />
                  <Tooltip />
                  <ReferenceLine y={200} stroke="#d24a43" strokeDasharray="4 4" label="200ms demo rule" />
                  <Line type="monotone" dataKey="ms" stroke="#3885ab" dot={false} strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="scenario">
              <div className="scenario-h">Scenario console — show a judge in seconds</div>
              <div className="cta-row">
                <button className="btn small danger" onClick={() => simulate('outage')}>
                  Simulate Outage
                </button>
                <button className="btn small ghost" onClick={() => simulate('slowdown')}>
                  Simulate Slowdown
                </button>
                <button className="btn small" onClick={() => simulate('recover')}>
                  Recover
                </button>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="panel">
            <div className="panel-head">
              <div>
                <strong>Incidents &amp; credits</strong>
                <p>Each row already emailed twice — to you and to the vendor</p>
              </div>
              <span className="tag count">{data.incidents.length} total</span>
            </div>
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TYPE</th>
                  <th>STARTED</th>
                  <th>CREDIT</th>
                  <th>CLAIM BY</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.incidents.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <span className={`tag ${i.type}`}>{i.type}</span>
                    </td>
                    <td className="mono">{new Date(i.started_at).toLocaleString()}</td>
                    <td className="mono strong">${i.credit_usd}</td>
                    <td className="mono">{i.claim_deadline}</td>
                    <td>
                      <span className={`tag ${i.status}`}>{i.status}</span>
                    </td>
                  </tr>
                ))}
                {!data.incidents.length && (
                  <tr>
                    <td colSpan="5" className="empty">
                      No violations yet — everything green. Try “Simulate Outage”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="panel">
            <div className="panel-head">
              <div>
                <strong>Claim email log</strong>
                <p>Company alerts and vendor claims, side by side</p>
              </div>
              <span className="tag count">{data.notifications.length} sent</span>
            </div>
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TO</th>
                  <th>KIND</th>
                  <th>SUBJECT</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.notifications.map((n) => (
                  <tr key={n.id}>
                    <td className="mono">{n.to_email}</td>
                    <td>
                      <span className={`tag ${n.kind}`}>{n.kind}</span>
                    </td>
                    <td>{n.subject}</td>
                    <td>
                      <span className={`tag ${n.status}`}>{n.status}</span>
                    </td>
                  </tr>
                ))}
                {!data.notifications.length && (
                  <tr>
                    <td colSpan="4" className="empty">
                      No emails yet — they appear here the moment a violation fires.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="panel saas-row">
            <strong>Vendor coverage</strong>
            <div className="saas-pills">
              {data.saas.map((s) => (
                <span key={s.provider} className={`tag ${s.status}`}>
                  {s.status === 'active' && <span className="dot live" />}
                  {s.provider} · {s.status}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
