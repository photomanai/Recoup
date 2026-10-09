import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import api from '../api';

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
  }, []);

  async function activate() {
    await api.post('/saas/cloudflare/activate', { zoneInfo: { domain: 'example.com' } });
    setMsg('Cloudflare activated — monitoring every 30s');
    load();
  }

  async function simulate(m) {
    const { data: d } = await api.post(`/simulate/${m}`);
    setMode(d.mode);
    setMsg(m === 'recover' ? 'Recovered to normal' : `Simulation started: ${m}`);
    setTimeout(load, 1500);
  }

  function logout() {
    localStorage.clear();
    nav('/');
  }

  const cf = data.saas.find((s) => s.provider === 'cloudflare');
  const last = data.metrics[data.metrics.length - 1];
  const lat = last ? last.latency_ms : 0;
  const up = last ? (last.uptime ? '100%' : '0%') : '—';
  const chart = data.metrics.slice(-40).map((m) => ({
    t: new Date(m.ts).toLocaleTimeString(),
    ms: m.latency_ms,
  }));

  return (
    <div className="wrap">
      <nav className="nav">
        <div className="logo">
          Recoup<span>.</span>
        </div>
        <div>
          <Link to="/">Home</Link>
          <button className="btn small ghost" onClick={logout} style={{ marginLeft: 12 }}>
            Logout
          </button>
        </div>
      </nav>

      <h1>Dashboard</h1>
      <p className="sub">
        Cloudflare status:{' '}
        {cf?.status === 'active' ? (
          <span style={{ color: '#0e7c5b' }}>
            <span className="dot live" /> ACTIVE — monitored 24/7
          </span>
        ) : (
          <span style={{ color: '#b97f1f' }}>DISABLED — activate to start</span>
        )}
      </p>
      {cf?.status !== 'active' && (
        <button className="btn" onClick={activate}>
          Activate Cloudflare
        </button>
      )}
      {msg && <p style={{ color: '#3885ab' }}>{msg}</p>}

      <div className="panel">
        <div className="stats">
          <div className="stat">
            <div className="k">UPTIME NOW</div>
            <div className={up === '0%' ? 'v bad' : 'v good'}>{up}</div>
          </div>
          <div className="stat">
            <div className="k">LAST LATENCY</div>
            <div className={lat > 200 ? 'v bad' : 'v good'}>{lat} ms</div>
          </div>
          <div className="stat">
            <div className="k">EST. REFUND (MONTH)</div>
            <div className="v good mono">${data.totalCredit}</div>
          </div>
          <div className="stat">
            <div className="k">SIM MODE</div>
            <div className="v mono" style={{ fontSize: 20 }}>{mode}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <strong>Latency (last 40 checks) — Demo rule: &gt;200ms</strong>
        <div style={{ height: 220, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={chart}>
              <XAxis dataKey="t" hide />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={200} stroke="#d24a43" strokeDasharray="4 4" label="200ms demo rule" />
              <Line type="monotone" dataKey="ms" stroke="#3885ab" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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

      <div className="panel">
        <strong>Incidents &amp; credits</strong>
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
              <tr key={i.id} className="alert-row">
                <td>{i.type}</td>
                <td className="mono">{new Date(i.started_at).toLocaleString()}</td>
                <td className="mono">${i.credit_usd}</td>
                <td className="mono">{i.claim_deadline}</td>
                <td>{i.status}</td>
              </tr>
            ))}
            {!data.incidents.length && (
              <tr>
                <td colSpan="5" style={{ color: '#6ba1bc' }}>
                  No violations yet — everything green.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <strong>Notification log (company + vendor claim emails)</strong>
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
                <td>{n.kind}</td>
                <td>{n.subject}</td>
                <td>{n.status}</td>
              </tr>
            ))}
            {!data.notifications.length && (
              <tr>
                <td colSpan="4" style={{ color: '#6ba1bc' }}>
                  No emails sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
