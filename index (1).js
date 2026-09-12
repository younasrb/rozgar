import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getCurrentUser, signOut } from '../../lib/auth';
import {
  getPendingApplications,
  approveApplication,
  rejectApplication,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  getApprovedSellersFull,
  getAllSellerProducts,
  approveProductRequest,
  rejectProductRequest,
  getPendingSaleRequests,
  approveSaleRequest,
  rejectSaleRequest,
  getSignedScreenshotUrl,
} from '../../lib/api';

const CATEGORY_OPTIONS = ['Antivirus/Security', 'Online Course', 'Mobile Data'];

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]); // flat list of seller_products rows (all sellers)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [assignSelections, setAssignSelections] = useState({}); // { [applicationId]: productId }
  const [requestActionId, setRequestActionId] = useState(null); // seller_products row id currently being approved/rejected
  const [saleRequests, setSaleRequests] = useState([]); // Pending sale_requests waiting for payment-screenshot review
  const [saleRequestActionId, setSaleRequestActionId] = useState(null);
  const [screenshotLoadingId, setScreenshotLoadingId] = useState(null);

  useEffect(() => {
    // Once products are loaded, pre-fill each pending application's assign-dropdown
    // with the product the seller actually requested (admin can still override it).
    if (products.length === 0 || applications.length === 0) return;
    setAssignSelections((prev) => {
      const next = { ...prev };
      applications.forEach((app) => {
        if (next[app.id] === undefined && app.requested_product_id) {
          next[app.id] = app.requested_product_id;
        }
      });
      return next;
    });
  }, [products, applications]);

  const [newProduct, setNewProduct] = useState({
    id: '',
    name: '',
    category: CATEGORY_OPTIONS[0],
    price: '',
    description: '',
  });
  const [productError, setProductError] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    async function load() {
      const profile = await getCurrentUser();
      if (!profile || profile.role !== 'admin') {
        router.push('/login');
        return;
      }
      setUser(profile);
      await refreshApplications();
      await refreshProducts();
      await refreshSellers();
      await refreshSellerProducts();
      await refreshSaleRequests();
      setLoading(false);
    }
    load();
  }, [router]);

  async function refreshApplications() {
    const res = await getPendingApplications();
    if (res.success) setApplications(res.applications);
  }

  async function refreshSaleRequests() {
    const res = await getPendingSaleRequests();
    if (res.success) setSaleRequests(res.saleRequests);
  }

  async function handleViewScreenshot(path) {
    setScreenshotLoadingId(path);
    const res = await getSignedScreenshotUrl(path);
    setScreenshotLoadingId(null);
    if (!res.success) {
      alert(`Couldn't load screenshot: ${res.error}`);
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  async function handleApproveSaleRequest(id) {
    setSaleRequestActionId(id);
    const res = await approveSaleRequest(id);
    setSaleRequestActionId(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    await refreshSaleRequests();
  }

  async function handleRejectSaleRequest(id) {
    if (!confirm('Reject this sale request? No commission will be credited for it.')) return;
    setSaleRequestActionId(id);
    const res = await rejectSaleRequest(id);
    setSaleRequestActionId(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    await refreshSaleRequests();
  }

  async function refreshProducts() {
    const res = await getProducts();
    if (res.success) setProducts(res.products);
  }

  async function refreshSellers() {
    const res = await getApprovedSellersFull();
    if (res.success) setSellers(res.applications);
  }

  async function refreshSellerProducts() {
    const res = await getAllSellerProducts();
    if (res.success) setSellerProducts(res.sellerProducts);
  }

  async function handleApproveProductRequest(id) {
    setRequestActionId(id);
    const res = await approveProductRequest(id);
    if (!res.success) alert(res.error);
    await refreshSellerProducts();
    setRequestActionId(null);
  }

  async function handleRejectProductRequest(id) {
    setRequestActionId(id);
    const res = await rejectProductRequest(id);
    if (!res.success) alert(res.error);
    await refreshSellerProducts();
    setRequestActionId(null);
  }

  async function handleApprove(id) {
    const productId = assignSelections[id];
    if (!productId) {
      alert('Please pick which product this seller will sell before approving.');
      return;
    }
    setActionId(id);
    const res = await approveApplication(id, productId);
    if (!res.success) alert(res.error);
    await refreshApplications();
    await refreshSellers();
    await refreshSellerProducts();
    setActionId(null);
  }

  async function handleReject(id) {
    setActionId(id);
    await rejectApplication(id);
    await refreshApplications();
    setActionId(null);
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    setProductError('');

    if (!newProduct.id || !newProduct.name || !newProduct.price) {
      setProductError('Product ID, name and price are required.');
      return;
    }

    setAddingProduct(true);

    let imageUrl = null;
    if (imageFile) {
      const uploadRes = await uploadProductImage(newProduct.id.trim(), imageFile);
      if (!uploadRes.success) {
        setAddingProduct(false);
        setProductError(`Image upload failed: ${uploadRes.error}`);
        return;
      }
      imageUrl = uploadRes.url;
    }

    const res = await addProduct({
      id: newProduct.id.trim(),
      name: newProduct.name.trim(),
      category: newProduct.category,
      price: Number(newProduct.price),
      description: newProduct.description.trim(),
      imageUrl,
    });
    setAddingProduct(false);

    if (!res.success) {
      setProductError(res.error);
      return;
    }

    setNewProduct({ id: '', name: '', category: CATEGORY_OPTIONS[0], price: '', description: '' });
    setImageFile(null);
    setImagePreview(null);
    await refreshProducts();
  }

  async function handleDeleteProduct(id) {
    if (!confirm(`Delete product "${id}"? This can't be undone.`)) return;
    setDeletingId(id);
    const res = await deleteProduct(id);
    setDeletingId(null);

    if (!res.success) {
      alert(
        res.error.includes('foreign key')
          ? 'Can\'t delete this product — it already has orders/commissions linked to it.'
          : res.error
      );
      return;
    }
    await refreshProducts();
  }

  function handleStartEdit(product) {
    setEditingId(product.id);
    setEditForm({
      name: product.name,
      category: product.category,
      price: product.price,
      description: product.description || '',
    });
    setEditImageFile(null);
    setEditImagePreview(product.image_url || null);
    setEditError('');
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditError('');
  }

  function handleEditImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
  }

  async function handleSaveEdit(id) {
    setEditError('');

    if (!editForm.name || !editForm.price) {
      setEditError('Name and price are required.');
      return;
    }

    setSavingEdit(true);

    let imageUrl;
    if (editImageFile) {
      const uploadRes = await uploadProductImage(id, editImageFile);
      if (!uploadRes.success) {
        setSavingEdit(false);
        setEditError(`Image upload failed: ${uploadRes.error}`);
        return;
      }
      imageUrl = uploadRes.url;
    }

    const res = await updateProduct(id, {
      name: editForm.name.trim(),
      category: editForm.category,
      price: Number(editForm.price),
      description: editForm.description.trim(),
      imageUrl,
    });
    setSavingEdit(false);

    if (!res.success) {
      setEditError(res.error);
      return;
    }

    handleCancelEdit();
    await refreshProducts();
  }

  if (loading) return <div className="loading-screen">Loading admin dashboard…</div>;

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
          <span className="brand">Rozgar <span className="brand-sub">Admin</span></span>
          <nav className="nav-right">
            <span className="user-name">{user?.full_name}</span>
            <button className="link-btn" onClick={() => signOut().then(() => router.push('/'))}>
              Log out
            </button>
          </nav>
        </div>
      </header>

      <div className="page">
        <h1>Admin dashboard</h1>

        <section className="stats-row">
          <div className="stat-card highlight">
            <span className="stat-label">Pending review</span>
            <span className="stat-value">{applications.length}</span>
          </div>
          <div className="stat-card highlight">
            <span className="stat-label">Sale requests to review</span>
            <span className="stat-value">{saleRequests.length}</span>
          </div>
        </section>

        <section className="panel">
          <h2>Sale requests (payment screenshot approval)</h2>
          {saleRequests.length === 0 ? (
            <p className="empty-state">No sale requests waiting for review right now.</p>
          ) : (
            <div className="app-list">
              {saleRequests.map((sr) => (
                <div key={sr.id} className="app-row" style={{ flexWrap: 'wrap' }}>
                  <div className="app-info">
                    <strong>{sr.seller?.full_name || 'Unknown seller'}</strong>
                    <span className="app-meta">
                      Sold: {sr.product?.name || sr.product_id} · Rs. {Number(sr.price).toFixed(0)}
                    </span>
                    <span className="app-meta">
                      Customer: {sr.customer_name}
                      {sr.customer_phone ? ` · ${sr.customer_phone}` : ''}
                    </span>
                  </div>
                  <button
                    className="edit-btn"
                    onClick={() => handleViewScreenshot(sr.payment_screenshot_path)}
                    disabled={screenshotLoadingId === sr.payment_screenshot_path}
                  >
                    {screenshotLoadingId === sr.payment_screenshot_path ? 'Loading…' : '🖼️ View screenshot'}
                  </button>
                  <div className="app-actions">
                    <button
                      className="approve-btn"
                      disabled={saleRequestActionId === sr.id}
                      onClick={() => handleApproveSaleRequest(sr.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      disabled={saleRequestActionId === sr.id}
                      onClick={() => handleRejectSaleRequest(sr.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Seller applications</h2>
          {applications.length === 0 ? (
            <p className="empty-state">No pending applications right now.</p>
          ) : (
            <div className="app-list">
              {applications.map((app) => (
                <div key={app.id} className="app-row">
                  <div className="app-info">
                    <strong>{app.full_name}</strong>
                    <span className="app-meta">
                      {app.city || 'City not given'}
                      {app.ngo_reference ? ` · NGO ref: ${app.ngo_reference}` : ''}
                    </span>
                    {app.requested_product_id && (
                      <span className="app-meta requested-tag">
                        Requested: {products.find((p) => p.id === app.requested_product_id)?.name || app.requested_product_id}
                      </span>
                    )}
                  </div>
                  <span className="badge badge-pending">{app.status}</span>
                  <select
                    className="assign-select"
                    value={assignSelections[app.id] || ''}
                    onChange={(e) =>
                      setAssignSelections({ ...assignSelections, [app.id]: e.target.value })
                    }
                  >
                    <option value="">Assign a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (#{p.id})
                      </option>
                    ))}
                  </select>
                  <div className="app-actions">
                    <button
                      className="approve-btn"
                      disabled={actionId === app.id}
                      onClick={() => handleApprove(app.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      disabled={actionId === app.id}
                      onClick={() => handleReject(app.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Employees (Approved sellers)</h2>
          {sellers.length === 0 ? (
            <p className="empty-state">No approved sellers yet.</p>
          ) : (
            <div className="app-list">
              {sellers.map((s) => {
                const rowsForSeller = sellerProducts.filter((sp) => sp.seller_id === s.user_id);
                const approvedRows = rowsForSeller.filter((sp) => sp.status === 'Approved');
                const pendingRows = rowsForSeller.filter((sp) => sp.status === 'Pending');

                return (
                  <div key={s.id} className="app-row" style={{ flexWrap: 'wrap' }}>
                    <div className="app-info">
                      <strong>{s.full_name}</strong>
                      <span className="app-meta">{s.city || 'City not given'}</span>
                      <span className="app-meta">
                        Selling:{' '}
                        {approvedRows.length > 0
                          ? approvedRows
                              .map((sp) => products.find((p) => p.id === sp.product_id)?.name || sp.product_id)
                              .join(', ')
                          : 'Nothing approved yet'}
                      </span>
                    </div>

                    {pendingRows.length > 0 && (
                      <div className="app-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        {pendingRows.map((sp) => (
                          <div key={sp.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className="app-meta requested-tag">
                              Wants to add: {products.find((p) => p.id === sp.product_id)?.name || sp.product_id}
                            </span>
                            <button
                              className="approve-btn"
                              disabled={requestActionId === sp.id}
                              onClick={() => handleApproveProductRequest(sp.id)}
                            >
                              Approve
                            </button>
                            <button
                              className="reject-btn"
                              disabled={requestActionId === sp.id}
                              onClick={() => handleRejectProductRequest(sp.id)}
                            >
                              Reject
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Products</h2>

          <form className="product-form" onSubmit={handleAddProduct}>
            <div className="form-row">
              <div className="form-field">
                <label>Product ID</label>
                <input
                  placeholder="e.g. P004"
                  value={newProduct.id}
                  onChange={(e) => setNewProduct({ ...newProduct, id: e.target.value })}
                />
              </div>
              <div className="form-field grow">
                <label>Name</label>
                <input
                  placeholder="e.g. SecureShield 1-Year License"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Category</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Price (PKR)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 1000"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Description (optional)</label>
              <input
                placeholder="Short description shown to customers"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>Product picture (optional)</label>
              <input type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="image-preview" />
              )}
            </div>

            {productError && <p className="error-text">{productError}</p>}

            <button className="approve-btn" type="submit" disabled={addingProduct}>
              {addingProduct ? 'Adding…' : '+ Add product'}
            </button>
          </form>

          <div className="product-table">
            {products.length === 0 ? (
              <p className="empty-state">No products yet — add one above.</p>
            ) : (
              products.map((p) => (
                <div key={p.id} className="product-row">
                  {editingId === p.id ? (
                    <div className="edit-form">
                      <div className="form-row">
                        <div className="form-field grow">
                          <label>Name</label>
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </div>
                        <div className="form-field">
                          <label>Category</label>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          >
                            {CATEGORY_OPTIONS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Price (PKR)</label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.price}
                            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-field">
                        <label>Description</label>
                        <input
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        />
                      </div>
                      <div className="form-field">
                        <label>Replace picture (optional)</label>
                        <input type="file" accept="image/*" onChange={handleEditImageChange} />
                        {editImagePreview && (
                          <img src={editImagePreview} alt="Preview" className="image-preview" />
                        )}
                      </div>
                      {editError && <p className="error-text">{editError}</p>}
                      <div className="edit-actions">
                        <button
                          className="approve-btn"
                          disabled={savingEdit}
                          onClick={() => handleSaveEdit(p.id)}
                        >
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button className="reject-btn" disabled={savingEdit} onClick={handleCancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="product-thumb" />
                      ) : (
                        <div className="product-thumb product-thumb-empty">🛒</div>
                      )}
                      <div className="product-info">
                        <strong>{p.name}</strong>
                        <span className="app-meta">
                          #{p.id} · {p.category} · Rs. {p.price}
                        </span>
                      </div>
                      <div className="edit-actions">
                        <button className="edit-btn" onClick={() => handleStartEdit(p)}>
                          Edit
                        </button>
                        <button
                          className="reject-btn"
                          disabled={deletingId === p.id}
                          onClick={() => handleDeleteProduct(p.id)}
                        >
                          {deletingId === p.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Reports</h2>
          <p className="empty-state">
            Sales and revenue reports can be added here by querying the <code>orders</code> and{' '}
            <code>commissions</code> tables directly in Supabase.
          </p>
        </section>
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
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          border-radius: 14px;
          padding: 20px;
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          min-width: 180px;
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
          font-size: 28px;
          font-weight: 600;
          color: #1f4e5f;
        }

        .panel {
          background: white;
          border-radius: 14px;
          padding: 22px;
        }

        .app-list {
          display: flex;
          flex-direction: column;
        }

        .app-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px solid #eef2f2;
        }

        .app-row:last-child {
          border-bottom: none;
        }

        .app-info {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .app-meta {
          font-size: 13px;
          color: #7a8a8d;
        }

        .badge {
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .badge-pending {
          background: #fdecc8;
          color: #8a5a12;
        }

        .app-actions {
          display: flex;
          gap: 8px;
        }

        .approve-btn {
          background: #1f4e5f;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        }

        .approve-btn:hover {
          background: #163a47;
        }

        .reject-btn {
          background: white;
          color: #b33939;
          border: 1px solid #f0c8c8;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        }

        .reject-btn:hover {
          background: #fdf2f2;
        }

        .approve-btn:disabled,
        .reject-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .empty-state {
          color: #6b7878;
          font-size: 14px;
        }

        code {
          background: #f2f6f3;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
        }

        .assign-select {
          padding: 8px 10px;
          border: 1px solid #dde5e5;
          border-radius: 8px;
          font-size: 13px;
          max-width: 220px;
        }

        .requested-tag {
          color: #1f4e5f;
          font-weight: 600;
        }
          background: #f9fbfa;
          border: 1px solid #eef2f2;
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 20px;
        }

        .form-row {
          display: flex;
          gap: 14px;
        }

        .form-field {
          margin-bottom: 12px;
          flex: 1;
        }

        .form-field.grow {
          flex: 2;
        }

        .form-field label {
          display: block;
          font-size: 13px;
          color: #6b7878;
          margin-bottom: 4px;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          padding: 9px 10px;
          border: 1px solid #dde5e5;
          border-radius: 8px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }

        .error-text {
          color: #b33939;
          font-size: 13px;
          margin: 4px 0 10px;
        }

        .product-table {
          display: flex;
          flex-direction: column;
        }

        .product-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid #eef2f2;
        }

        .product-row:last-child {
          border-bottom: none;
        }

        .product-info {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .product-thumb {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
        }

        .product-thumb-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f2f6f3;
          font-size: 22px;
        }

        .image-preview {
          margin-top: 8px;
          width: 80px;
          height: 80px;
          object-fit: cover;
          border-radius: 8px;
          display: block;
        }

        .edit-form {
          width: 100%;
        }

        .edit-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .edit-btn {
          background: white;
          color: #1f4e5f;
          border: 1px solid #cfe0e0;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        }

        .edit-btn:hover {
          background: #f2f6f3;
        }

        @media (max-width: 640px) {
          .app-row {
            flex-wrap: wrap;
          }

          .form-row {
            flex-direction: column;
            gap: 0;
          }
        }
      `}</style>
    </div>
  );
}
