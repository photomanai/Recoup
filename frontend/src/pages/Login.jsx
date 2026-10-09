import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('companyId', data.company.id);
      nav('/dashboard');
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Login failed');
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
          <Link to="/register">Register</Link>
        </div>
      </nav>
      <h1>Login</h1>
      <form className="form" onSubmit={submit}>
        <label>EMAIL</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
        <label>PASSWORD</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" />
        {err && <p style={{ color: '#d24a43' }}>{err}</p>}
        <button className="btn" type="submit">
          Login
        </button>
      </form>
    </div>
  );
}
