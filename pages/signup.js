import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { signUp } from '../lib/auth';
import { createApplication, getProducts } from '../lib/api';

export default function Signup() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [city, setCity] = useState('');
  const [ngoReference, setNgoReference] = useState('');
  const [products, setProducts] = useState([]);
  const [requestedProductId, setRequestedProductId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      const res = await getProducts();
      if (res.success) setProducts(res.products);
    }
    loadProducts();
  }, []);

  async function handleSignup(e) {
    e.preventDefault();
    setError('');

    if (role === 'employee' && !requestedProductId) {
      setError('Please choose which product you want to sell.');
      return;
    }

    setLoading(true);

    const result = await signUp(email, password, fullName, role, city);

    if (!result.success) {
      setLoading(false);
      setError(result.error);
      return;
    }

    // If signing up as an employee (seller), also create a pending application
    if (role === 'employee') {
      await createApplication({
        userId: result.user.id,
        fullName,
        city,
        ngoReference,
        requestedProductId,
      });
    }

    setLoading(false);

    if (role === 'admin') router.push('/admin');
    else if (role === 'employee') router.push('/employee');
    else router.push('/'); // customers land on the shop (home page)
  }

  return (
    <div>
      <nav className="navbar">
        <strong>Rozgar</strong>
        <div>
          <Link href="/login">Log in</Link>
        </div>
      </nav>

      <div className="container" style={{ maxWidth: 420 }}>
        <h1>Create your account</h1>

        <div className="card">
          <form onSubmit={handleSignup}>
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />

            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            <label>I want to join as</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="customer">Customer (buy products)</option>
              <option value="employee">Seller (resell products & earn commission)</option>
            </select>
            <p style={{ fontSize: 13, color: '#777' }}>
              Admin accounts aren't self-serve — ask an existing Admin, or see the README for how
              to create the first one.
            </p>

            <label>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />

            {role === 'employee' && (
              <>
                <label>Which product do you want to sell?</label>
                <select
                  value={requestedProductId}
                  onChange={(e) => setRequestedProductId(e.target.value)}
                  required
                >
                  <option value="">Choose a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Rs. {p.price} ({p.category})
                    </option>
                  ))}
                </select>

                <label>NGO reference (optional)</label>
                <input value={ngoReference} onChange={(e) => setNgoReference(e.target.value)} />
                <p style={{ fontSize: 14, color: '#555' }}>
                  Your seller application (and product request) will need Admin approval before
                  you can start selling.
                </p>
              </>
            )}

            {error && <p className="error-text">{error}</p>}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
