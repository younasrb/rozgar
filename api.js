// api.js
// The 4 core functions from the PRD/M3 task sheet.
// Function names match the PRD exactly so M1/M2 frontend code doesn't need to change.

import { supabase } from './supabaseClient';

// Commission rules per product category (from PRD)
const COMMISSION_RULES = {
  'Antivirus/Security': { sellerRate: 0.20, fundRate: 0.05 },
  'Online Course': { sellerRate: 0.15, fundRate: 0.05 },
  'Mobile Data': { sellerRate: 0.08, fundRate: 0.05 },
};

/**
 * Create a new seller application (Pending by default).
 */
export async function createApplication({ userId, fullName, city, ngoReference, requestedProductId }) {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      full_name: fullName,
      city,
      ngo_reference: ngoReference,
      requested_product_id: requestedProductId || null,
      status: 'Pending',
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, application: data };
}

/**
 * Approve a pending application. Admin must assign exactly ONE product this
 * seller will sell (per the Rozgar model — each seller specializes in one product).
 */
export async function approveApplication(applicationId, productId) {
  if (!productId) {
    return { success: false, error: 'You must assign a product before approving this seller.' };
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ status: 'Approved', assigned_product_id: productId })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Seed this seller's first product as already-approved in seller_products, so it shows up
  // alongside any future products they request through the seller dashboard.
  await supabase
    .from('seller_products')
    .insert({ seller_id: data.user_id, product_id: productId, status: 'Approved' });

  return { success: true, application: data };
}

/**
 * Reject a pending application.
 */
export async function rejectApplication(applicationId) {
  const { data, error } = await supabase
    .from('applications')
    .update({ status: 'Rejected' })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, application: data };
}

/**
 * Place an order and automatically calculate + save commission.
 */
export async function placeOrder(customerId, sellerId, productId, walkInCustomer = {}) {
  // 1. Get product to know price + category
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (productError) return { success: false, error: productError.message };

  // 2. Create the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      customer_name: walkInCustomer.customerName || null,
      customer_phone: walkInCustomer.customerPhone || null,
      seller_id: sellerId,
      product_id: productId,
      price: product.price,
    })
    .select()
    .single();

  if (orderError) return { success: false, error: orderError.message };

  // 3. Calculate commission + education fund
  const rule = COMMISSION_RULES[product.category] || { sellerRate: 0.10, fundRate: 0.05 };
  const sellerCommission = product.price * rule.sellerRate;
  const educationFund = (product.price - sellerCommission) * rule.fundRate;

  // 4. Save commission row
  const { data: commission, error: commissionError } = await supabase
    .from('commissions')
    .insert({
      order_id: order.id,
      seller_id: sellerId,
      seller_commission: sellerCommission,
      education_fund_amount: educationFund,
    })
    .select()
    .single();

  if (commissionError) return { success: false, error: commissionError.message };

  return { success: true, order, commission };
}

/**
 * Upload a payment screenshot for a sale request. Stored under "<sellerId>/<filename>" in the
 * private 'payment-screenshots' bucket — storage RLS uses that folder name to check ownership.
 * Returns the storage PATH (not a public URL, since the bucket is private). Use
 * getSignedScreenshotUrl() to view it later.
 */
export async function uploadPaymentScreenshot(sellerId, file) {
  const ext = file.name.split('.').pop();
  const path = `${sellerId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-screenshots')
    .upload(path, file, { upsert: true });

  if (uploadError) return { success: false, error: uploadError.message };
  return { success: true, path };
}

/**
 * Get a short-lived signed URL to view a payment screenshot (the bucket is private).
 */
export async function getSignedScreenshotUrl(path) {
  const { data, error } = await supabase.storage
    .from('payment-screenshots')
    .createSignedUrl(path, 60 * 60); // valid for 1 hour

  if (error) return { success: false, error: error.message };
  return { success: true, url: data.signedUrl };
}

/**
 * Seller records a sale with proof of payment. This does NOT create an order or commission yet —
 * it creates a Pending sale_requests row. An Admin must review the screenshot and approve it
 * before the sale counts and the commission is credited (see approveSaleRequest()).
 */
export async function requestSale({ sellerId, productId, customerName, customerPhone, screenshotPath }) {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('price')
    .eq('id', productId)
    .single();

  if (productError) return { success: false, error: productError.message };

  const { data, error } = await supabase
    .from('sale_requests')
    .insert({
      seller_id: sellerId,
      product_id: productId,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      price: product.price,
      payment_screenshot_path: screenshotPath,
      status: 'Pending',
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, saleRequest: data };
}

/**
 * Get one seller's own sale requests, split by status.
 */
export async function getMySaleRequests(sellerId) {
  const { data, error } = await supabase
    .from('sale_requests')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    pending: data.filter((r) => r.status === 'Pending'),
    approved: data.filter((r) => r.status === 'Approved'),
    rejected: data.filter((r) => r.status === 'Rejected'),
  };
}

/**
 * Admin: get every Pending sale request (with seller + product info) waiting for review.
 */
export async function getPendingSaleRequests() {
  const { data, error } = await supabase
    .from('sale_requests')
    .select('*, seller:seller_id ( full_name, city ), product:product_id ( name, category )')
    .eq('status', 'Pending')
    .order('created_at', { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, saleRequests: data };
}

/**
 * Admin: approve a sale request. This is the ONLY place a door-to-door sale actually turns
 * into an order + commission — it reuses the same placeOrder() logic so the commission math
 * stays in one place.
 */
export async function approveSaleRequest(id) {
  const { data: saleRequest, error: fetchError } = await supabase
    .from('sale_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (saleRequest.status !== 'Pending') {
    return { success: false, error: 'This sale request has already been reviewed.' };
  }

  const result = await placeOrder(null, saleRequest.seller_id, saleRequest.product_id, {
    customerName: saleRequest.customer_name,
    customerPhone: saleRequest.customer_phone,
  });

  if (!result.success) return result;

  const { error: updateError } = await supabase
    .from('sale_requests')
    .update({ status: 'Approved', order_id: result.order.id })
    .eq('id', id);

  if (updateError) return { success: false, error: updateError.message };
  return { success: true, order: result.order, commission: result.commission };
}

/**
 * Admin: reject a sale request. No order or commission is ever created for it.
 */
export async function rejectSaleRequest(id) {
  const { data, error } = await supabase
    .from('sale_requests')
    .update({ status: 'Rejected' })
    .eq('id', id)
    .eq('status', 'Pending')
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, saleRequest: data };
}

/**
 * Get a seller's total sales + total commission earned.
 */
export async function getCommissionSummary(sellerId) {
  const { data, error } = await supabase
    .from('commissions')
    .select('seller_commission, education_fund_amount')
    .eq('seller_id', sellerId);

  if (error) return { success: false, error: error.message };

  const totalSales = data.length;
  const totalCommission = data.reduce((sum, row) => sum + Number(row.seller_commission), 0);
  const totalFundContribution = data.reduce((sum, row) => sum + Number(row.education_fund_amount), 0);

  return { success: true, totalSales, totalCommission, totalFundContribution };
}

/**
 * Get the logged-in seller's own application (to check Pending/Approved/Rejected status).
 */
export async function getMyApplication(userId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, application: data };
}

/**
 * Get every approved seller with their assigned/requested product info (Admin management view).
 */
export async function getApprovedSellersFull() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('status', 'Approved')
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, applications: data };
}

/**
 * Seller: request to add a NEW product to their lineup. This does not sell it immediately —
 * it creates a Pending row that only an Admin can approve. A seller can hold as many approved
 * products as they like; there's no limit and no "switch" — products are additive.
 */
export async function requestAddProduct(sellerId, productId) {
  const { data, error } = await supabase
    .from('seller_products')
    .insert({ seller_id: sellerId, product_id: productId, status: 'Pending' })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, sellerProduct: data };
}

/**
 * Get one seller's products, split by status. If the same product was requested more than once
 * (e.g. rejected then re-requested), only the most recent request for that product is kept.
 */
export async function getSellerProducts(sellerId) {
  const { data, error } = await supabase
    .from('seller_products')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };

  const latestByProduct = {};
  for (const row of data) {
    if (!latestByProduct[row.product_id]) latestByProduct[row.product_id] = row;
  }
  const rows = Object.values(latestByProduct);

  return {
    success: true,
    approved: rows.filter((r) => r.status === 'Approved'),
    pending: rows.filter((r) => r.status === 'Pending'),
    rejected: rows.filter((r) => r.status === 'Rejected'),
  };
}

/**
 * Admin: every seller's product requests, across all sellers (used to build the Admin's
 * "Product requests" panel). Also de-duplicates to the latest request per seller+product.
 */
export async function getAllSellerProducts() {
  const { data, error } = await supabase
    .from('seller_products')
    .select('*, seller:seller_id ( full_name, city )')
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };

  const latestByKey = {};
  for (const row of data) {
    const key = `${row.seller_id}:${row.product_id}`;
    if (!latestByKey[key]) latestByKey[key] = row;
  }

  return { success: true, sellerProducts: Object.values(latestByKey) };
}

/**
 * Admin: approve a seller's pending product request.
 */
export async function approveProductRequest(id) {
  const { data, error } = await supabase
    .from('seller_products')
    .update({ status: 'Approved' })
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, sellerProduct: data };
}

/**
 * Admin: reject a seller's pending product request.
 */
export async function rejectProductRequest(id) {
  const { data, error } = await supabase
    .from('seller_products')
    .update({ status: 'Rejected' })
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, sellerProduct: data };
}

export async function getPendingApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('status', 'Pending');

  if (error) return { success: false, error: error.message };
  return { success: true, applications: data };
}

/**
 * Get all products (for Customer dashboard browsing).
 */
export async function getProducts() {
  const { data, error } = await supabase.from('products').select('*').order('id');
  if (error) return { success: false, error: error.message };
  return { success: true, products: data };
}

/**
 * Upload a product image file to Supabase Storage and return its public URL.
 */
export async function uploadProductImage(productId, file) {
  const ext = file.name.split('.').pop();
  const path = `${productId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true });

  if (uploadError) return { success: false, error: uploadError.message };

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return { success: true, url: data.publicUrl };
}

/**
 * Add a new product (Admin only).
 */
export async function addProduct({ id, name, category, price, description, imageUrl }) {
  const { data, error } = await supabase
    .from('products')
    .insert({ id, name, category, price, description, image_url: imageUrl || null })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, product: data };
}

/**
 * Update an existing product (Admin only).
 */
export async function updateProduct(id, { name, category, price, description, imageUrl }) {
  const updates = { name, category, price, description };
  if (imageUrl !== undefined) updates.image_url = imageUrl;

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, product: data };
}

/**
 * Delete a product (Admin only).
 */
export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Get all approved sellers (employees) — used at checkout to assign an order to a seller.
 */
export async function getApprovedSellers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('role', 'employee');

  if (error) return { success: false, error: error.message };
  return { success: true, sellers: data };
}
