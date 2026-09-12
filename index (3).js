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

// Plain DOM-level pointer tilt — no React state, so it stays smooth at 60fps
// and never re-renders the tree while the cursor moves.
function handleCardMove(e) {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  const rotateY = (px - 0.5) * 12;
  const rotateX = (0.5 - py) * 12;
  card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.015)`;
}
function handleCardLeave(e) {
  e.currentTarget.style.transform = '';
}

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

    const newOrders = [];
    const failedIndexes = [];
    const failureReasons = [];
    let impact = 0;
    // Guests (no login) place orders with customer_id = null — still works fine,
    // the order/commission math doesn't depend on who the customer is.
    const customerId = user?.id ?? null;

    // Each seller now specializes in exactly ONE assigned product, so we look up
    // (and randomly pick among) the sellers assigned to THIS specific item —
    // not just "any approved seller." Cached per product in case the cart has
    // more than one of the same item.
    const sellersByProduct = {};

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];

      if (!sellersByProduct[item.id]) {
        const sellerRes = await getApprovedSellers(item.id);
        sellersByProduct[item.id] = sellerRes.success ? sellerRes.sellers : [];
      }
      const candidateSellers = sellersByProduct[item.id];

      if (candidateSellers.length === 0) {
        failedIndexes.push(i);
        failureReasons.push(`${item.name} (no seller assigned to this product yet)`);
        continue;
      }

      // Randomly assign a matching seller per order so orders (and the
      // commission that comes with them) get spread across everyone who's
      // approved for this product, instead of always going to the same one.
      const seller = candidateSellers[Math.floor(Math.random() * candidateSellers.length)];
      const orderRes = await placeOrder(customerId, seller.id, item.id);
      if (orderRes.success) {
        newOrders.push({ ...orderRes.order, productName: item.name });
        impact += Number(orderRes.commission.education_fund_amount);
      } else {
        console.error(`Order failed for ${item.name}:`, orderRes.error);
        failedIndexes.push(i);
        failureReasons.push(item.name);
      }
    }

    if (newOrders.length === 0) {
      // Nothing went through — keep the cart intact so the customer can retry.
      setCheckoutState('idle');
      alert("Sorry, we couldn't place your order right now. Please try again in a moment.");
      return;
    }

    setOrderHistory([...newOrders, ...orderHistory]);
    setLastOrderImpact(impact);
    // Only clear the items that actually succeeded — leave any failed ones in the
    // cart (matched by position) so the customer doesn't lose their spot and can retry.
    const stillInCart = cart.filter((_, i) => failedIndexes.includes(i));
    setCart(stillInCart);
    setCheckoutState('done');

    if (stillInCart.length > 0) {
      alert(`Everything else went through, but these items couldn't be ordered and are still in your cart: ${failureReasons.join(', ')}`);
    }
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
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
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
              <Link href="/login" className="link-btn staff-link">
                Staff Login
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
        <div className="hero-scene" aria-hidden="true">
          <div className="floatie f1">🛡️</div>
          <div className="floatie f2">🎓</div>
          <div className="floatie f3">📶</div>
          <svg className="hero-ring" viewBox="0 0 200 200" width="200" height="200">
            <defs>
              <radialGradient id="ringGlow" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#3d7a91" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#3d7a91" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="94" fill="url(#ringGlow)" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(220,234,234,0.25)" strokeWidth="1.5" strokeDasharray="3 7" />
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
        {visibleProducts.map((p) => {
          const fundShare = (p.price * FUND_RATE_DISPLAY).toFixed(0);
          return (
            <article
              key={p.id}
              className="product-card"
              onMouseMove={handleCardMove}
              onMouseLeave={handleCardLeave}
            >
              <div className="product-card-inner">
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
                <div className="impact-coin">
                  <span className="coin-icon" />
                  ≈ Rs. {fundShare} to the education fund
                </div>
              </div>
            </article>
          );
        })}
        {visibleProducts.length === 0 && (
          <p className="empty-state">No products in this category yet.</p>
        )}
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
            <div className="seal">✓</div>
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
          --ink: #14313d;
          --teal: #1f4e5f;
          --teal-deep: #163947;
          --teal-mist: #dceaea;
          --paper: #f2f6f3;
          --amber: #e8a33d;
          --amber-light: #f0b158;
          --amber-deep: #c67f22;
          --amber-shadow: #a9691a;
          font-family: 'Inter', -apple-system, sans-serif;
          background: var(--paper);
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
          color: var(--teal);
          margin: 0 0 12px 0;
        }

        button:focus-visible,
        a:focus-visible {
          outline: 2px solid var(--amber-deep);
          outline-offset: 2px;
        }

        .shop-nav {
          background: var(--teal);
          position: sticky;
          top: 0;
          z-index: 20;
          box-shadow: 0 4px 16px rgba(20, 49, 61, 0.25);
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
          color: var(--teal-mist);
          font-size: 14px;
        }

        .cart-btn {
          position: relative;
          background: white;
          color: var(--teal);
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 0 rgba(20, 49, 61, 0.15), 0 4px 10px rgba(0, 0, 0, 0.15);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }

        .cart-btn:active {
          transform: translateY(2px);
          box-shadow: 0 0 0 rgba(20, 49, 61, 0.15), 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        .cart-count {
          position: absolute;
          top: -8px;
          right: -8px;
          background: linear-gradient(155deg, var(--amber-light), var(--amber-deep));
          color: white;
          border-radius: 999px;
          font-size: 12px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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

        .hero {
          max-width: 1080px;
          margin: 32px auto 36px;
          padding: 48px 44px;
          border-radius: 28px;
          background: linear-gradient(155deg, var(--teal) 0%, var(--teal-deep) 100%);
          box-shadow: 0 24px 50px -14px rgba(20, 49, 61, 0.5), 0 2px 6px rgba(20, 49, 61, 0.3);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 40px;
          position: relative;
          overflow: hidden;
        }

        .hero-text {
          position: relative;
          z-index: 2;
        }

        .hero-text h1 {
          color: white;
          font-size: 34px;
          line-height: 1.25;
          font-weight: 600;
          max-width: 480px;
        }

        .hero-text p {
          max-width: 460px;
          font-size: 16px;
          line-height: 1.6;
          color: #cfe3e3;
        }

        .hero-scene {
          position: relative;
          width: 200px;
          height: 200px;
          flex-shrink: 0;
        }

        .hero-ring {
          position: absolute;
          top: 0;
          left: 0;
        }

        .floatie {
          position: absolute;
          width: 58px;
          height: 58px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          box-shadow: 0 14px 26px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          animation: floaty 5.5s ease-in-out infinite;
          z-index: 2;
        }

        .floatie.f1 {
          top: 6px;
          left: 34px;
          background: linear-gradient(155deg, #3d7a91, var(--teal));
          animation-delay: 0s;
        }

        .floatie.f2 {
          top: 66px;
          left: 122px;
          background: linear-gradient(155deg, var(--amber-light), var(--amber-deep));
          animation-delay: 1.1s;
        }

        .floatie.f3 {
          top: 128px;
          left: 24px;
          background: linear-gradient(155deg, #7fb8a8, #3d8570);
          animation-delay: 2.2s;
        }

        @keyframes floaty {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .floatie { animation: none; }
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
          background: linear-gradient(180deg, #ffffff, #eef4f3);
          border: 1px solid var(--teal-mist);
          padding: 9px 18px;
          border-radius: 999px;
          font-size: 14px;
          cursor: pointer;
          color: #22282a;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 2px 5px rgba(20, 49, 61, 0.08);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .chip:hover {
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 6px 12px rgba(20, 49, 61, 0.14);
        }

        .chip-active {
          background: linear-gradient(180deg, #2a6178, var(--teal));
          color: white;
          border-color: var(--teal);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 6px 14px rgba(20, 49, 61, 0.35);
        }

        .product-grid {
          max-width: 1080px;
          margin: 0 auto;
          padding: 8px 24px 48px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 26px;
        }

        .product-card {
          border-radius: 18px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%);
          box-shadow:
            0 1px 2px rgba(20, 49, 61, 0.06),
            0 8px 16px rgba(20, 49, 61, 0.08),
            0 26px 40px -16px rgba(20, 49, 61, 0.22);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          transform-style: preserve-3d;
          will-change: transform;
        }

        .product-card:hover {
          box-shadow:
            0 2px 4px rgba(20, 49, 61, 0.08),
            0 14px 24px rgba(20, 49, 61, 0.12),
            0 34px 56px -16px rgba(20, 49, 61, 0.3);
        }

        .product-card-inner {
          padding: 22px;
          display: flex;
          flex-direction: column;
          height: 100%;
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
        }

        .product-category {
          font-size: 12px;
          color: #7a8a8d;
          margin-bottom: 4px;
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
          margin-bottom: 14px;
        }

        .price {
          font-weight: 600;
          font-size: 16px;
        }

        .add-btn {
          background: linear-gradient(180deg, var(--amber-light) 0%, var(--amber) 45%, var(--amber-deep) 100%);
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 3px 0 var(--amber-shadow), 0 6px 12px rgba(198, 127, 34, 0.35);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }

        .add-btn:hover {
          filter: brightness(1.03);
        }

        .add-btn:active {
          transform: translateY(3px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 0 var(--amber-shadow), 0 2px 4px rgba(198, 127, 34, 0.3);
        }

        .add-btn:disabled {
          opacity: 0.6;
          cursor: default;
          transform: none;
        }

        .full-width {
          width: 100%;
          margin-top: 12px;
        }

        .impact-coin {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          align-self: flex-start;
          background: linear-gradient(145deg, #fff6e6, #f3d9a6);
          border: 1px solid #e8c078;
          color: #8a5d1f;
          padding: 5px 10px 5px 6px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 2px rgba(138, 93, 31, 0.25);
        }

        .coin-icon {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          flex-shrink: 0;
          background: radial-gradient(circle at 35% 30%, #ffe9b8, var(--amber) 60%, var(--amber-shadow));
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
        }

        .order-history {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px 60px;
        }

        .receipts {
          background: white;
          border-radius: 16px;
          padding: 8px 20px;
          box-shadow: 0 8px 20px -8px rgba(20, 49, 61, 0.18);
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
          background: rgba(20, 49, 61, 0.4);
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
          background: var(--paper);
          box-shadow: -8px 0 30px rgba(20, 49, 61, 0.25);
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
          border-bottom: 1px solid var(--teal-mist);
        }

        .cart-item-price {
          font-size: 13px;
          color: #4d5a5d;
        }

        .cart-summary {
          margin-top: 20px;
          border-top: 1px solid var(--teal-mist);
          padding-top: 16px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .impact-row {
          color: var(--teal);
          font-weight: 600;
        }

        .receipt-confirm {
          text-align: center;
          padding-top: 24px;
        }

        .seal {
          width: 64px;
          height: 64px;
          margin: 0 auto 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: white;
          background: radial-gradient(circle at 35% 30%, #7fd6a8, #2e9c62 65%, #1f7a4a);
          box-shadow: 0 10px 20px rgba(46, 156, 98, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.3);
        }

        .impact-highlight {
          background: var(--teal-mist);
          color: var(--teal);
          font-weight: 600;
          padding: 14px;
          border-radius: 10px;
          margin: 16px 0;
        }

        @media (max-width: 640px) {
          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 36px 28px;
          }
          .hero-scene {
            align-self: center;
          }
        }
      `}</style>
    </div>
  );
}
