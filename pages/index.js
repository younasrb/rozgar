import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { getCurrentUser, signOut } from '../lib/auth';
import { getProducts, getApprovedSellers, placeOrder } from '../lib/api';

const FUND_RATE_DISPLAY = 0.05; // shown to customers as the education-fund share of net revenue

const CATEGORY_ICONS = {
  'Antivirus/Security': '🛡️',
  'Online Course': '🎓',
  'Mobile Data': '📶',
};

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [orderHistory, setOrderHistory] = useState([]);
  const [checkoutState, setCheckoutState] = useState('idle'); // idle | processing | done
  const [lastOrderImpact, setLastOrderImpact] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Customers can browse and buy as a guest — login is optional here.
      // If someone is logged in (e.g. came from the nav), we still show their name.
      const profile = await getCurrentUser();
      setUser(profile); // null is fine — treated as "Guest" in the UI

      const productRes = await getProducts();
      if (productRes.success) setProducts(productRes.products);

      setLoading(false);
    }
    load();
  }, [router]);

  const categories = useMemo(() => {
    const unique = [...new Set(products.map((p) => p.category))];
    return ['All', ...unique];
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  // Group whatever is currently visible into { categoryName: [products] } sections,
  // in the same order the category chips appear — this powers the category-wise layout below.
  const groupedProducts = useMemo(() => {
    const order = categories.filter((c) => c !== 'All');
    const groups = {};
    order.forEach((cat) => {
      const items = visibleProducts.filter((p) => p.category === cat);
      if (items.length > 0) groups[cat] = items;
    });
    return groups;
  }, [visibleProducts, categories]);

  function addToCart(product) {
    setCart([...cart, product]);
    setCartOpen(true);
  }

  function removeFromCart(index) {
    setCart(cart.filter((_, i) => i !== index));
  }

  const total = cart.reduce((sum, p) => sum + Number(p.price), 0);
  const estimatedImpact = total * FUND_RATE_DISPLAY;

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckoutState('processing');

    const sellerRes = await getApprovedSellers();
    if (!sellerRes.success || sellerRes.sellers.length === 0) {
      setCheckoutState('idle');
      alert('No approved sellers available yet — check back soon.');
      return;
    }
    const seller = sellerRes.sellers[0];

    const newOrders = [];
    let impact = 0;
    // Guests (no login) place orders with customer_id = null — still works fine,
    // the order/commission math doesn't depend on who the customer is.
    const customerId = user?.id ?? null;
    for (const item of cart) {
      const orderRes = await placeOrder(customerId, seller.id, item.id);
      if (orderRes.success) {
        newOrders.push({ ...orderRes.order, productName: item.name });
        impact += Number(orderRes.commission.education_fund_amount);
      }
    }

    setOrderHistory([...newOrders, ...orderHistory]);
    setLastOrderImpact(impact);
    setCart([]);
    setCheckoutState('done');
  }

  function closeReceipt() {
    setCheckoutState('idle');
    setCartOpen(false);
  }

  if (loading) return <div className="loading-screen">Loading your marketplace…</div>;

  return (
    <div className="shop">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className="shop-nav">
        <div className="shop-nav-inner">
          <span className="brand">Rozgar</span>
          <nav className="nav-right">
            <span className="user-name">{user?.full_name || 'Guest'}</span>
            <button className="cart-btn" onClick={() => setCartOpen(true)}>
              Cart
              {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
            </button>
            {user ? (
              <button className="link-btn" onClick={() => signOut().then(() => router.push('/'))}>
                Log out
              </button>
            ) : (
              <Link href="/login" className="staff-link">
                Join as Affiliate
              </Link>
            )}
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <h1>Everyday essentials.<br />A share for a child's school year.</h1>
          <p>
            Every antivirus license, course, or data bundle you buy here is sold by someone
            building an income — and a slice of each sale goes straight to the education fund.
          </p>
        </div>
        <div className="hero-mark" aria-hidden="true">
          <svg viewBox="0 0 200 200" width="180" height="180">
            <defs>
              <radialGradient id="circleGrad" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#EAF4F4" />
                <stop offset="60%" stopColor="#D3E6E6" />
                <stop offset="100%" stopColor="#B9D5D5" />
              </radialGradient>
              <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2A6178" />
                <stop offset="100%" stopColor="#163540" />
              </linearGradient>
              <linearGradient id="postGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2A6178" />
                <stop offset="100%" stopColor="#163540" />
              </linearGradient>
              <radialGradient id="beadGrad" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#F6C871" />
                <stop offset="100%" stopColor="#D1912F" />
              </radialGradient>
              <filter id="capShadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0f2a33" floodOpacity="0.35" />
              </filter>
            </defs>

            <circle cx="100" cy="100" r="92" fill="url(#circleGrad)" />
            <ellipse cx="72" cy="62" rx="38" ry="20" fill="white" opacity="0.35" />

            <g filter="url(#capShadow)">
              <path d="M60 96 L100 72 L140 96 L100 120 Z" fill="url(#capGrad)" />
              <rect x="94" y="118" width="12" height="34" rx="3" fill="url(#postGrad)" />
              <circle cx="140" cy="96" r="6" fill="url(#beadGrad)" />
            </g>
          </svg>
        </div>
      </section>

      <section className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`chip ${activeCategory === cat ? 'chip-active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat !== 'All' && CATEGORY_ICONS[cat] ? `${CATEGORY_ICONS[cat]} ` : ''}
            {cat}
          </button>
        ))}
      </section>

      <section className="product-grid">
        {Object.keys(groupedProducts).length === 0 && (
          <p className="empty-state">No products in this category yet.</p>
        )}
        {Object.entries(groupedProducts).map(([cat, items], groupIndex) => (
          <div
            key={cat}
            className="category-section"
            style={{ '--group-delay': `${groupIndex * 90}ms` }}
          >
            <h2 className="category-title">
              <span>{CATEGORY_ICONS[cat] || '🛒'}</span> {cat}
            </h2>
            <div className="category-row">
              {items.map((p, i) => {
                const fundShare = (p.price * FUND_RATE_DISPLAY).toFixed(0);
                return (
                  <article
                    key={p.id}
                    className="product-card"
                    style={{ '--card-delay': `${groupIndex * 90 + i * 70}ms` }}
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="product-image" />
                    ) : (
                      <div className="product-icon">{CATEGORY_ICONS[p.category] || '🛒'}</div>
                    )}
                    <span className="product-category">{p.category}</span>
                    <h3>{p.name}</h3>
                    <p className="product-desc">{p.description}</p>
                    <div className="product-footer">
                      <span className="price">Rs. {p.price}</span>
                      <button className="add-btn" onClick={() => addToCart(p)}>Add to cart</button>
                    </div>
                    <p className="impact-line">≈ Rs. {fundShare} of this goes to the education fund</p>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {orderHistory.length > 0 && (
        <section className="order-history">
          <h2>Your orders</h2>
          <div className="receipts">
            {orderHistory.map((o) => (
              <div key={o.id} className="receipt">
                <div>
                  <strong>{o.productName}</strong>
                  <div className="receipt-id">#{o.id.slice(0, 8)}</div>
                </div>
                <span>Rs. {o.price}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cart drawer */}
      <div className={`cart-overlay ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`}>
        {checkoutState === 'done' ? (
          <div className="receipt-confirm">
            <h2>Order confirmed</h2>
            <p>Thanks for your purchase.</p>
            <p className="impact-highlight">Rs. {lastOrderImpact.toFixed(0)} of this order goes toward the education fund.</p>
            <button className="add-btn full-width" onClick={closeReceipt}>Continue shopping</button>
          </div>
        ) : (
          <>
            <div className="cart-header">
              <h2>Your cart</h2>
              <button className="link-btn" onClick={() => setCartOpen(false)}>Close</button>
            </div>

            {cart.length === 0 ? (
              <p className="empty-state">Your cart is empty.</p>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item, i) => (
                    <div key={i} className="cart-item">
                      <div>
                        <strong>{item.name}</strong>
                        <div className="cart-item-price">Rs. {item.price}</div>
                      </div>
                      <button className="link-btn" onClick={() => removeFromCart(i)}>Remove</button>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>Rs. {total}</span>
                  </div>
                  <div className="summary-row impact-row">
                    <span>Education fund contribution</span>
                    <span>≈ Rs. {estimatedImpact.toFixed(0)}</span>
                  </div>
                  <button
                    className="add-btn full-width"
                    onClick={handleCheckout}
                    disabled={checkoutState === 'processing'}
                  >
                    {checkoutState === 'processing' ? 'Placing order…' : 'Checkout'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </aside>

      <style jsx>{`
        .shop {
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

        h1, h2, h3 {
          font-family: 'Fraunces', serif;
          color: #1f4e5f;
          margin: 0 0 12px 0;
        }

        .shop-nav {
          background: #1f4e5f;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .shop-nav-inner {
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

        .nav-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .user-name {
          color: #dceaea;
          font-size: 14px;
        }

        .cart-btn {
          position: relative;
          background: white;
          color: #1f4e5f;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .cart-count {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #e8a33d;
          color: white;
          border-radius: 999px;
          font-size: 12px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .link-btn {
          background: none;
          border: none;
          color: inherit;
          text-decoration: underline;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
        }

        .shop-nav .link-btn {
          color: white;
        }

        .staff-link {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #e8a33d, #d1912f);
          color: white;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          padding: 8px 18px;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(232, 163, 61, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          white-space: nowrap;
          animation: staffPulse 2.4s ease-in-out infinite;
        }

        .staff-link::before {
          content: '';
          position: absolute;
          top: 0;
          left: -60%;
          width: 40%;
          height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.55), transparent);
          transform: skewX(-20deg);
          animation: staffShine 2.6s ease-in-out infinite;
        }

        .staff-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(232, 163, 61, 0.55);
          animation-play-state: paused;
        }

        @keyframes staffPulse {
          0%, 100% {
            box-shadow: 0 2px 8px rgba(232, 163, 61, 0.35);
          }
          50% {
            box-shadow: 0 2px 16px rgba(232, 163, 61, 0.7);
          }
        }

        @keyframes staffShine {
          0% {
            left: -60%;
          }
          55% {
            left: 130%;
          }
          100% {
            left: 130%;
          }
        }

        .hero {
          max-width: 1080px;
          margin: 0 auto;
          padding: 56px 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 32px;
        }

        .hero-text h1 {
          font-size: 34px;
          line-height: 1.25;
          font-weight: 600;
          max-width: 480px;
        }

        .hero-text p {
          max-width: 460px;
          font-size: 16px;
          line-height: 1.6;
          color: #445055;
        }

        .hero-mark {
          flex-shrink: 0;
          animation: heroFloat 4s ease-in-out infinite;
        }

        @keyframes heroFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        .categories {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px 24px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .chip {
          background: white;
          border: 1px solid #dceaea;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 14px;
          cursor: pointer;
          color: #22282a;
          transition: transform 0.15s ease, background 0.2s ease, color 0.2s ease;
        }

        .chip:hover {
          transform: translateY(-2px);
        }

        .chip:active {
          transform: scale(0.96);
        }

        .chip-active {
          background: #1f4e5f;
          color: white;
          border-color: #1f4e5f;
        }

        .product-grid {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px 48px;
          display: flex;
          flex-direction: column;
          gap: 36px;
        }

        .category-section {
          animation: sectionFadeIn 0.5s ease both;
          animation-delay: var(--group-delay, 0ms);
        }

        .category-title {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          color: #1f4e5f;
          margin: 0 0 14px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 18px;
          perspective: 1000px;
        }

        @keyframes sectionFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }

        @keyframes cardFadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }

        .product-card {
          background: white;
          border-radius: 16px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          animation: cardFadeSlideUp 0.5s ease both;
          animation-delay: var(--card-delay, 0ms);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.35s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
          border: 1px solid #eef2f2;
          transform-style: preserve-3d;
          will-change: transform;
          overflow: hidden;
        }

        .product-card:hover {
          transform: perspective(900px) rotateX(3deg) rotateY(-3deg) translateY(-10px) scale(1.025);
          box-shadow: 0 24px 40px -12px rgba(31, 78, 95, 0.28), 0 8px 16px rgba(31, 78, 95, 0.1);
          border-color: #cfe0e0;
          z-index: 2;
        }

        .product-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .product-image {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: 10px;
          margin-bottom: 10px;
          transition: transform 0.4s ease;
        }

        .product-card:hover .product-image {
          transform: scale(1.06);
        }

        .product-category {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #1f4e5f;
          background: #eaf2f0;
          padding: 3px 10px;
          border-radius: 999px;
          margin-bottom: 8px;
          align-self: flex-start;
        }

        .product-card h3 {
          font-size: 18px;
          margin-bottom: 6px;
        }

        .product-desc {
          font-size: 14px;
          color: #4d5a5d;
          flex-grow: 1;
          margin-bottom: 16px;
        }

        .product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .price {
          font-weight: 700;
          font-size: 18px;
          color: #1f4e5f;
        }

        .add-btn {
          background: #e8a33d;
          color: white;
          border: none;
          padding: 9px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          transition: transform 0.15s ease, background 0.2s ease;
        }

        .add-btn:hover {
          background: #d1912f;
          transform: translateY(-2px);
        }

        .add-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .full-width {
          width: 100%;
          margin-top: 12px;
        }

        .impact-line {
          font-size: 12px;
          color: #1f4e5f;
          margin-top: 10px;
          margin-bottom: 0;
        }

        .order-history {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px 60px;
        }

        .receipts {
          background: white;
          border-radius: 14px;
          padding: 8px 20px;
        }

        .receipt {
          display: flex;
          justify-content: space-between;
          padding: 14px 0;
          border-bottom: 1px solid #eef2f2;
        }

        .receipt:last-child {
          border-bottom: none;
        }

        .receipt-id {
          font-size: 12px;
          color: #94a3a3;
        }

        .empty-state {
          color: #6b7878;
          font-size: 14px;
        }

        .cart-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          z-index: 30;
        }

        .cart-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .cart-drawer {
          position: fixed;
          top: 0;
          right: -380px;
          width: 360px;
          max-width: 90vw;
          height: 100vh;
          background: #f2f6f3;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
          padding: 28px 24px;
          transition: right 0.25s ease;
          z-index: 31;
          overflow-y: auto;
        }

        .cart-drawer.open {
          right: 0;
        }

        .cart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #dceaea;
        }

        .cart-item-price {
          font-size: 13px;
          color: #4d5a5d;
        }

        .cart-summary {
          margin-top: 20px;
          border-top: 1px solid #dceaea;
          padding-top: 16px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .impact-row {
          color: #1f4e5f;
          font-weight: 600;
        }

        .receipt-confirm {
          text-align: center;
          padding-top: 40px;
        }

        .impact-highlight {
          background: #dceaea;
          color: #1f4e5f;
          font-weight: 600;
          padding: 14px;
          border-radius: 10px;
          margin: 16px 0;
        }

        @media (max-width: 640px) {
          .hero {
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-mark {
            align-self: center;
          }
        }
      `}</style>
    </div>
  );
}
