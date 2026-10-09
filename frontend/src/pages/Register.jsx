import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({
    companyName: '',
    email: '',
    password: '',
    aiEmail: '',
    aiAppPassword: '',
    monthlyFee: 200,
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/auth/register', { ...f, monthlyFee: Number(f.monthlyFee) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('companyId', data.company.id);
      nav('/dashboard');
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div className="wrap">
      <nav className="nav">
        <div className="logo">
          Recoup<span>.</span>
        </div>
        <div>
          <Link to="/">Home</Link>
          <Link to="/login">Login</Link>
        </div>
      </nav>
      <h1>Register company</h1>
      <p className="sub">Full packet: company + login + AI sender Gmail (App Password) + monthly fee.</p>
      <form className="form" onSubmit={submit}>
        <label>COMPANY NAME</label>
        <input value={f.companyName} onChange={set('companyName')} required placeholder="Acme Inc" />
        <label>COMPANY EMAIL (LOGIN)</label>
        <input value={f.email} onChange={set('email')} required type="email" placeholder="ops@acme.com" />
        <label>PASSWORD</label>
        <input value={f.password} onChange={set('password')} required type="password" placeholder="••••••••" />
        <label>AI SENDER GMAIL</label>
        <input value={f.aiEmail} onChange={set('aiEmail')} required type="email" placeholder="ai-sender@gmail.com" />
        <label>AI APP PASSWORD (GMAIL APP PASSWORD)</label>
        <input
          value={f.aiAppPassword}
          onChange={set('aiAppPassword')}
          required
          type="password"
          placeholder="xxxx xxxx xxxx xxxx"
        />
        <label>MONTHLY CLOUDFLARE FEE (USD)</label>
        <input value={f.monthlyFee} onChange={set('monthlyFee')} required type="number" min="1" />
        {err && <p style={{ color: '#d24a43' }}>{err}</p>}
        <button className="btn" type="submit">
          Create account
        </button>
      </form>
    </div>
  );
}
