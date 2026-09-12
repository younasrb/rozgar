import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { signIn } from '../lib/auth';

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [invalidCredentials, setInvalidCredentials] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setInvalidCredentials(false);
    setLoading(true);

    const result = await signIn(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      setInvalidCredentials(!!result.invalidCredentials);
      return;
    }

    const role = result.profile.role;
    if (role === 'admin') router.push('/admin');
    else if (role === 'employee') router.push('/employee');
    else router.push('/'); // customers land on the shop (home page)
  }

  return (
    <div>
      <nav className="navbar">
        <strong>Rozgar</strong>
        <div>
          <Link href="/">← Back to shop</Link>
        </div>
      </nav>

      <div className="container" style={{ maxWidth: 420 }}>
        <h1>Staff Login</h1>
        <p>For sellers and admins only. Customers don't need an account — just shop.</p>

        <div className="card">
          <h2>Log in</h2>
          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="error-text">
                {error}
                {invalidCredentials && (
                  <>
                    {' '}
                    <Link href="/signup">Sign up here</Link>
                  </>
                )}
              </p>
            )}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>

        <p>
          No account? <Link href="/signup">Sign up here</Link>
        </p>
      </div>
    </div>
  );
}
