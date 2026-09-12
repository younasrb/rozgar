import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getCurrentUser, signOut } from '../../lib/auth';
import { getProducts, getCommissionSummary, getMyApplication, requestProductChange, placeOrder } from '../../lib/api';

const CATEGORY_ICONS = {
  'Antivirus/Security': '🛡️',
  'Online Course': '🎓',
  'Mobile Data': '📶',
};

// Fallback response if the Grok API is unreachable or the key isn't set yet —
// keeps the demo working even without internet/API access.
function getFallbackResponse(text) {
  const t = text.toLowerCase();
  if (t.includes('kya bechna') || t.includes('what should i sell')) {
    return 'Try SecureShield Antivirus (P001) — easiest to explain, and it pays 20% commission, the highest of all products.';
  }
  if (t.includes('antivirus') && (t.includes('explain') || t.includes('customer'))) {
    return 'Tell the customer: "This protects your phone/computer from viruses for a full year, and takes 2 minutes to activate."';
  }
  if (t.includes('commission') && (t.includes('kab') || t.includes('when'))) {
    return 'Commission is credited as soon as the order is confirmed in the system — no waiting period.';
  }
  return "I can help you pick a product, write a sales pitch, or explain commission. Try asking me 'what should I sell?'";
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]); // kept for backwards-compat, but only ever holds the ONE assigned product
  const [summary, setSummary] = useState({ totalSales: 0, totalCommission: 0, totalFundContribution: 0 });
  const [messages, setMessages] = useState([
    { from: 'ai', text: "Hi! Ask me what you should sell, or how to explain a product to a customer." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState(null); // 'Pending' | 'Approved' | 'Rejected' | null
  const [application, setApplication] = useState(null);
  const [allProducts, setAllProducts] = useState([]); // full catalog, used for the "switch product" picker
  const [switchProductId, setSwitchProductId] = useState('');
  const [switchMsg, setSwitchMsg] = useState('');
  const [switching, setSwitching] = useState(false);

  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleCustomerPhone, setSaleCustomerPhone] = useState('');
  const [recordingSale, setRecordingSale] = useState(false);
  const [saleMsg, setSaleMsg] = useState('');

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser();
      if (!profile) {
        router.push('/login');
        return;
      }
      setUser(profile);

      // Gate access: an employee/seller must be Admin-approved before using the dashboard.
      const appRes = await getMyApplication(profile.id);
      const app = appRes.success ? appRes.application : null;
      const status = app ? app.status : null;
      setApplicationStatus(status);
      setApplication(app);

      if (status !== 'Approved') {
        setLoading(false);
        return; // don't load products/commissions until approved
      }

      // Sellers only ever sell the ONE product the Admin assigned them.
      const productRes = await getProducts();
      if (productRes.success) {
        setAllProducts(productRes.products);
        const assigned = productRes.products.filter((p) => p.id === app.assigned_product_id);
        setProducts(assigned);
      }

      const summaryRes = await getCommissionSummary(profile.id);
      if (summaryRes.success) setSummary(summaryRes);

      setLoading(false);
    }
    load();
  }, [router]);

  const [aiTyping, setAiTyping] = useState(false);

  async function handleRecordSale(e) {
    e.preventDefault();
    if (!saleCustomerName.trim() || !application?.assigned_product_id) return;

    setRecordingSale(true);
    setSaleMsg('');

    const res = await placeOrder(null, user.id, application.assigned_product_id, {
      customerName: saleCustomerName.trim(),
      customerPhone: saleCustomerPhone.trim(),
    });

    setRecordingSale(false);

    if (!res.success) {
      setSaleMsg(`Error: ${res.error}`);
      return;
    }

    setSaleMsg(
      `✅ Sale confirmed! You earned Rs. ${res.commission.seller_commission.toFixed(0)} commission.`
    );
    setSaleCustomerName('');
    setSaleCustomerPhone('');

    // Refresh the commission summary so the stat cards update immediately.
    const summaryRes = await getCommissionSummary(user.id);
    if (summaryRes.success) setSummary(summaryRes);
  }

  async function handleRequestSwitch(e) {
    e.preventDefault();
    if (!switchProductId || !application) return;

    setSwitching(true);
    setSwitchMsg('');
    const res = await requestProductChange(application.id, switchProductId);
    setSwitching(false);

    if (!res.success) {
      setSwitchMsg(`Error: ${res.error}`);
      return;
    }
    setApplication(res.application);
    setSwitchMsg('Request sent! Waiting for Admin approval.');
    setSwitchProductId('');
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    const userMsg = { from: 'user', text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAiTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          products,
          sellerName: user?.full_name,
        }),
      });
      const data = await res.json();

      const replyText = res.ok ? data.reply : getFallbackResponse(userText);
      setMessages((prev) => [...prev, { from: 'ai', text: replyText }]);
    } catch (err) {
      setMessages((prev) => [...prev, { from: 'ai', text: getFallbackResponse(userText) }]);
    } finally {
      setAiTyping(false);
    }
  }

  if (loading) return <div className="loading-screen">Loading your dashboard…</div>;

  // Block access until the Admin has approved this seller's application.
  if (applicationStatus !== 'Approved') {
    return (
      <div className="dash">
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </Head>

        <header className="dash-nav">
          <div className="dash-nav-inner">
            <span className="brand">Rozgar <span className="brand-sub">Seller</span></span>
            <nav className="nav-right">
              <span className="user-name">{user?.full_name}</span>
              <button className="link-btn" onClick={() => signOut().then(() => router.push('/'))}>
                Log out
              </button>
            </nav>
          </div>
        </header>

        <div className="page">
          <div className="gate-card">
            {applicationStatus === 'Rejected' ? (
              <>
                <h1>Application not approved</h1>
                <p>
                  Unfortunately your seller application was not approved by the Admin. If you
                  think this is a mistake, please reach out to the Rozgar team.
                </p>
              </>
            ) : applicationStatus === 'Pending' ? (
              <>
                <h1>Waiting for Admin approval</h1>
                <p>
                  Your seller application has been submitted and is under review. You'll get
                  access to the seller dashboard, AI assistant and commission tracking as soon
                  as an Admin approves your application.
                </p>
              </>
            ) : (
              <>
                <h1>No application found</h1>
                <p>
                  We couldn't find a seller application linked to this account. Please sign up
                  again as a seller, or contact the Rozgar team for help.
                </p>
              </>
            )}
          </div>
        </div>

        <style jsx>{`
          .dash {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #f2f6f3;
            min-height: 100vh;
            color: #22282a;
          }
          .dash-nav {
            background: #1f4e5f;
            position: sticky;
            top: 0;
            z-index: 20;
          }
          .dash-nav-inner {
            max-width: 1080px;
            margin: 0 auto;
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .brand {
            font-family: 'Fraunces', serif;
            color: white;
            font-size: 22px;
            font-weight: 600;
          }
          .brand-sub {
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 500;
            color: #e8a33d;
            margin-left: 6px;
            vertical-align: middle;
          }
          .nav-right {
            display: flex;
            align-items: center;
            gap: 18px;
          }
          .user-name {
            color: #dceaea;
            font-size: 14px;
          }
          .link-btn {
            background: none;
            border: none;
            color: white;
            text-decoration: underline;
            cursor: pointer;
            font-size: 14px;
          }
          .page {
            max-width: 640px;
            margin: 0 auto;
            padding: 60px 24px;
          }
          .gate-card {
            background: white;
            border-radius: 14px;
            padding: 32px;
            text-align: center;
          }
          .gate-card h1 {
            font-family: 'Fraunces', serif;
            color: #1f4e5f;
            margin: 0 0 12px 0;
            font-size: 24px;
          }
          .gate-card p {
            color: #4a5556;
            line-height: 1.6;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dash">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className="dash-nav">
        <div className="dash-nav-inner">
          <span className="brand">Rozgar <span className="brand-sub">Seller</span></span>
          <nav className="nav-right">
            <span className="user-name">{user?.full_name}</span>
            <button className="link-btn" onClick={() => signOut().then(() => router.push('/'))}>
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="page">
        <h1>Welcome back, {user?.full_name?.split(' ')[0]}</h1>

        <section className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Total sales</span>
            <span className="stat-value">{summary.totalSales}</span>
          </div>
          <div className="stat-card highlight">
            <span className="stat-label">Commission earned</span>
            <span className="stat-value">Rs. {summary.totalCommission?.toFixed(0) || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Education fund contributed</span>
            <span className="stat-value">Rs. {summary.totalFundContribution?.toFixed(0) || 0}</span>
          </div>
        </section>

        <div className="content-grid">
          <section className="panel">
            <h2>Your assigned product</h2>
            <div className="product-list">
              {products.length === 0 ? (
                <p className="empty-state">
                  No product assigned yet — contact the Admin to get a product assigned to you.
                </p>
              ) : (
                products.map((p) => (
                  <div key={p.id} className="product-row">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="product-emoji-img" />
                    ) : (
                      <span className="product-emoji">{CATEGORY_ICONS[p.category] || '🛒'}</span>
                    )}
                    <div className="product-info">
                      <strong>{p.name}</strong>
                      <span className="product-meta">{p.category}</span>
                    </div>
                    <span className="product-price">Rs. {p.price}</span>
                  </div>
                ))
              )}
            </div>

            {products.length > 0 && (
              <div className="record-sale-box">
                <p className="switch-label">Just sold to a customer? Confirm it here:</p>
                <form onSubmit={handleRecordSale} className="record-sale-form">
                  <input
                    placeholder="Customer name"
                    value={saleCustomerName}
                    onChange={(e) => setSaleCustomerName(e.target.value)}
                    required
                  />
                  <input
                    placeholder="Customer phone (optional)"
                    value={saleCustomerPhone}
                    onChange={(e) => setSaleCustomerPhone(e.target.value)}
                  />
                  <button
                    className="approve-btn"
                    type="submit"
                    disabled={recordingSale || !saleCustomerName.trim()}
                  >
                    {recordingSale ? 'Confirming…' : '✅ Confirm sale'}
                  </button>
                </form>
                {saleMsg && <p className="switch-msg">{saleMsg}</p>}
              </div>
            )}

            <div className="switch-box">
              {application?.requested_product_id &&
              application.requested_product_id !== application.assigned_product_id ? (
                <p className="pending-note">
                  ⏳ Your request to switch to{' '}
                  <strong>
                    {allProducts.find((p) => p.id === application.requested_product_id)?.name ||
                      application.requested_product_id}
                  </strong>{' '}
                  is waiting for Admin approval.
                </p>
              ) : (
                <>
                  <p className="switch-label">Want to sell something else?</p>
                  <form onSubmit={handleRequestSwitch} className="switch-form">
                    <select
                      value={switchProductId}
                      onChange={(e) => setSwitchProductId(e.target.value)}
                    >
                      <option value="">Choose a different product…</option>
                      {allProducts
                        .filter((p) => p.id !== application?.assigned_product_id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — Rs. {p.price}
                          </option>
                        ))}
                    </select>
                    <button className="edit-btn" type="submit" disabled={switching || !switchProductId}>
                      {switching ? 'Sending…' : 'Request switch'}
                    </button>
                  </form>
                  {switchMsg && <p className="switch-msg">{switchMsg}</p>}
                </>
              )}
            </div>
          </section>

          <section className="panel chat-panel">
            <h2>AI sales assistant</h2>
            <div className="chat-box">
              {messages.map((m, i) => (
                <div key={i} className={`chat-message ${m.from === 'user' ? 'user' : 'ai'}`}>
                  {m.text}
                </div>
              ))}
              {aiTyping && <div className="chat-message ai typing">Thinking…</div>}
            </div>
            <form onSubmit={sendMessage} className="chat-input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. what should I sell?"
                disabled={aiTyping}
              />
              <button type="button" className="mic-btn" title="Voice input (coming soon)">🎤</button>
              <button className="send-btn" type="submit" disabled={aiTyping}>
                {aiTyping ? '…' : 'Send'}
              </button>
            </form>
          </section>
        </div>
      </div>

      <style jsx>{`
        .dash {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #f2f6f3;
          min-height: 100vh;
          color: #22282a;
        }

        .loading-screen {
          padding: 60px;
          text-align: center;
          font-family: 'Inter', sans-serif;
        }

        h1, h2 {
          font-family: 'Fraunces', serif;
          color: #1f4e5f;
          margin: 0 0 16px 0;
        }

        .dash-nav {
          background: #1f4e5f;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .dash-nav-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand {
          font-family: 'Fraunces', serif;
          color: white;
          font-size: 22px;
          font-weight: 600;
        }

        .brand-sub {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #e8a33d;
          margin-left: 6px;
          vertical-align: middle;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .user-name {
          color: #dceaea;
          font-size: 14px;
        }

        .link-btn {
          background: none;
          border: none;
          color: white;
          text-decoration: underline;
          cursor: pointer;
          font-size: 14px;
        }

        .page {
          max-width: 1080px;
          margin: 0 auto;
          padding: 40px 24px 60px;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }

        .stat-card {
          background: white;
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .stat-card.highlight {
          background: #1f4e5f;
        }

        .stat-card.highlight .stat-label,
        .stat-card.highlight .stat-value {
          color: white;
        }

        .stat-label {
          font-size: 13px;
          color: #7a8a8d;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #1f4e5f;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 20px;
        }

        .panel {
          background: white;
          border-radius: 14px;
          padding: 22px;
        }

        .product-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .product-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #eef2f2;
        }

        .product-row:last-child {
          border-bottom: none;
        }

        .product-emoji {
          font-size: 22px;
        }

        .product-emoji-img {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .empty-state {
          color: #7a8a8d;
          font-size: 14px;
          padding: 12px 0;
        }

        .record-sale-box {
          margin-top: 16px;
          padding: 14px;
          background: #f4faf6;
          border-radius: 10px;
        }

        .record-sale-form {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .record-sale-form input {
          flex: 1;
          min-width: 140px;
          padding: 9px 10px;
          border: 1px solid #dde5e5;
          border-radius: 8px;
          font-size: 14px;
        }

        .approve-btn {
          background: #2f7a4f;
          color: white;
          border: none;
          padding: 9px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          white-space: nowrap;
        }

        .approve-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .switch-box {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #eef2f2;
        }

        .switch-label {
          font-size: 13px;
          color: #6b7878;
          margin: 0 0 8px 0;
        }

        .switch-form {
          display: flex;
          gap: 8px;
        }

        .switch-form select {
          flex: 1;
          padding: 9px 10px;
          border: 1px solid #dde5e5;
          border-radius: 8px;
          font-size: 14px;
        }

        .edit-btn {
          background: #1f4e5f;
          color: white;
          border: none;
          padding: 9px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          white-space: nowrap;
        }

        .edit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .switch-msg {
          margin-top: 8px;
          font-size: 13px;
          color: #1f4e5f;
        }

        .pending-note {
          font-size: 14px;
          color: #8a6d1f;
          background: #fdf6e3;
          padding: 10px 12px;
          border-radius: 8px;
        }

        .product-info {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .product-meta {
          font-size: 12px;
          color: #7a8a8d;
        }

        .product-price {
          font-weight: 600;
        }

        .chat-box {
          border: 1px solid #dceaea;
          border-radius: 12px;
          height: 280px;
          overflow-y: auto;
          padding: 14px;
          background: #f7fafa;
          margin-bottom: 12px;
        }

        .chat-message {
          margin-bottom: 10px;
          padding: 9px 14px;
          border-radius: 10px;
          max-width: 85%;
          font-size: 14px;
          line-height: 1.4;
        }

        .chat-message.user {
          background: #1f4e5f;
          color: white;
          margin-left: auto;
        }

        .chat-message.ai {
          background: #dceaea;
          color: #1a2e33;
        }

        .chat-message.typing {
          font-style: italic;
          opacity: 0.7;
        }

        .chat-input-row {
          display: flex;
          gap: 8px;
        }

        .chat-input-row input {
          flex-grow: 1;
          padding: 10px 12px;
          border: 1px solid #dceaea;
          border-radius: 8px;
          font-size: 14px;
        }

        .mic-btn {
          background: #f2f6f3;
          border: 1px solid #dceaea;
          border-radius: 8px;
          padding: 0 14px;
          cursor: pointer;
          font-size: 16px;
        }

        .send-btn {
          background: #e8a33d;
          color: white;
          border: none;
          padding: 0 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .send-btn:hover {
          background: #d1912f;
        }

        @media (max-width: 720px) {
          .stats-row {
            grid-template-columns: 1fr;
          }
          .content-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
