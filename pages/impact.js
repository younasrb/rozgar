import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getPlatformImpact } from '../lib/api';

function formatPKR(n) {
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
}

export default function Impact() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getPlatformImpact();
      if (res.success) setStats(res);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="impact-page">
      <Head>
        <title>Our impact — Rozgar</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      <nav className="navbar">
        <Link href="/" className="brand">Rozgar</Link>
        <Link href="/">← Back to shop</Link>
      </nav>

      <div className="container">
        <h1>Every sale funds two things: a seller's income, and a child's education.</h1>
        <p className="intro">
          Rozgar is a digital reselling platform. Every seller keeps a commission on what they
          sell, and a share of the remaining revenue from every sale goes automatically into the
          Rozgar Education Fund. These are the real, live numbers behind that — pulled straight
          from our database, not marketing copy.
        </p>

        {loading ? (
          <p className="empty-state">Loading numbers…</p>
        ) : !stats ? (
          <p className="empty-state">Couldn't load impact numbers right now — please try again shortly.</p>
        ) : (
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{stats.sellersEmployed}</span>
              <span className="stat-label">sellers earning income on Rozgar</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.totalSales}</span>
              <span className="stat-label">sales completed</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatPKR(stats.totalCommissionsPaid)}</span>
              <span className="stat-label">paid out to sellers in commission</span>
            </div>
            <div className="stat-card highlight">
              <span className="stat-value">{formatPKR(stats.totalEducationFund)}</span>
              <span className="stat-label">contributed to the Education Fund</span>
            </div>
          </div>
        )}

        <div className="how-it-works">
          <h2>How the Education Fund works</h2>
          <p>
            After a seller's commission is deducted from a sale, 5% of the remaining company
            revenue is set aside for the Education Fund automatically — it is never taken out of
            the seller's own earnings. The number above is the running total across every
            completed sale on the platform.
          </p>
        </div>
      </div>

      <style jsx>{`
        .impact-page {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #f2f6f3;
          min-height: 100vh;
          color: #22282a;
        }

        h1, h2 {
          font-family: 'Fraunces', serif;
          color: #1f4e5f;
        }

        .navbar {
          background: #1f4e5f;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .navbar :global(a) {
          color: white;
          text-decoration: none;
          font-size: 14px;
        }

        .brand {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 18px;
        }

        .container {
          max-width: 840px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }

        h1 {
          font-size: 32px;
          line-height: 1.3;
          margin: 0 0 16px 0;
        }

        .intro {
          color: #4a5656;
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 36px;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 48px;
        }

        .stat-card {
          background: white;
          border-radius: 14px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .stat-card.highlight {
          background: #1f4e5f;
        }

        .stat-card.highlight .stat-value,
        .stat-card.highlight .stat-label {
          color: white;
        }

        .stat-value {
          font-family: 'Fraunces', serif;
          font-size: 30px;
          font-weight: 600;
          color: #1f4e5f;
        }

        .stat-label {
          font-size: 13px;
          color: #6b7878;
        }

        .how-it-works {
          border-top: 1px solid #dde5e5;
          padding-top: 24px;
        }

        .how-it-works p {
          color: #4a5656;
          line-height: 1.6;
          font-size: 14px;
        }

        .empty-state {
          color: #6b7878;
          font-size: 14px;
        }

        @media (max-width: 560px) {
          .stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
