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
 * Admin: immediately reassign an approved seller's product (no request/approval cycle needed —
 * admin has full authority). Also clears any pending change request on that application.
 */
export async function adminSetAssignedProduct(applicationId, productId) {
  const { data, error } = await supabase
    .from('applications')
    .update({ assigned_product_id: productId, requested_product_id: productId })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, application: data };
}

/**
 * Seller: request a different product to sell. This does NOT change assigned_product_id —
 * it only flags a pending request for the Admin to review and approve/reject.
 */
export async function requestProductChange(applicationId, newProductId) {
  const { data, error } = await supabase
    .from('applications')
    .update({ requested_product_id: newProductId })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, application: data };
}

/**
 * Admin: approve a seller's pending product-change request (requested_product_id becomes the
 * new assigned_product_id).
 */
export async function approveProductChange(applicationId, productId) {
  return adminSetAssignedProduct(applicationId, productId);
}

/**
 * Admin: reject a seller's pending product-change request — resets requested back to whatever
 * is currently assigned, so the "pending request" banner disappears.
 */
export async function rejectProductChange(applicationId, currentAssignedProductId) {
  const { data, error } = await supabase
    .from('applications')
    .update({ requested_product_id: currentAssignedProductId })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, application: data };
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

// ---------------------------------------------------------------------------
// SALE REQUESTS (door-to-door sales with proof-of-payment)
// A seller never creates a commission directly. Recording a walk-in sale uploads a
// payment screenshot to the private 'payment-screenshots' bucket and creates a Pending
// row here — the real order + commission only exist once an Admin reviews the screenshot
// and approves the request. This is what stops a seller from fabricating sales for
// commission they didn't actually earn.
// ---------------------------------------------------------------------------

/**
 * Seller: submit a walk-in sale for Admin review, with proof-of-payment attached.
 */
export async function createSaleRequest({ sellerId, productId, price, customerName, customerPhone, screenshotFile }) {
  const ext = screenshotFile.name.split('.').pop();
  const path = `${sellerId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-screenshots')
    .upload(path, screenshotFile);

  if (uploadError) return { success: false, error: uploadError.message };

  const { data, error } = await supabase
    .from('sale_requests')
    .insert({
      seller_id: sellerId,
      product_id: productId,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      price,
      payment_screenshot_path: path,
      status: 'Pending',
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, saleRequest: data };
}

/**
 * Seller: view their own sale requests (Pending/Approved/Rejected), newest first.
 */
export async function getMySaleRequests(sellerId) {
  const { data, error } = await supabase
    .from('sale_requests')
    .select('*, product:product_id(name)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, requests: data };
}

/**
 * Admin: every Pending sale request, oldest first (first in line to review).
 */
export async function getPendingSaleRequests() {
  const { data, error } = await supabase
    .from('sale_requests')
    .select('*, product:product_id(name), seller:seller_id(full_name)')
    .eq('status', 'Pending')
    .order('created_at', { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, requests: data };
}

/**
 * Get a short-lived signed URL to view a payment screenshot (the bucket is private).
 */
export async function getScreenshotSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from('payment-screenshots')
    .createSignedUrl(path, 300); // 5 minutes

  if (error) return { success: false, error: error.message };
  return { success: true, url: data.signedUrl };
}

/**
 * Admin: approve a Pending sale request. Only on approval does the real order +
 * commission get created — this is the one moment a seller's commission total goes up.
 */
export async function approveSaleRequest(requestId) {
  const { data: request, error: reqError } = await supabase
    .from('sale_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqError) return { success: false, error: reqError.message };
  if (request.status !== 'Pending') {
    return { success: false, error: 'This request was already reviewed.' };
  }

  const orderRes = await placeOrder(null, request.seller_id, request.product_id, {
    customerName: request.customer_name,
    customerPhone: request.customer_phone,
  });

  if (!orderRes.success) return orderRes;

  const { data, error } = await supabase
    .from('sale_requests')
    .update({ status: 'Approved', order_id: orderRes.order.id })
    .eq('id', requestId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, saleRequest: data, order: orderRes.order, commission: orderRes.commission };
}

/**
 * Admin: reject a Pending sale request. No order or commission is ever created.
 */
export async function rejectSaleRequest(requestId) {
  const { data, error } = await supabase
    .from('sale_requests')
    .update({ status: 'Rejected' })
    .eq('id', requestId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, saleRequest: data };
}

// ---------------------------------------------------------------------------
// PLATFORM IMPACT (public transparency numbers — the mission: jobs, commissions
// paid to sellers, and the Education Fund those sales generate).
// ---------------------------------------------------------------------------

/**
 * Public, aggregate-only numbers for the Impact page. Calls a security-definer SQL
 * function (see schema.sql) so anonymous visitors can see totals without any RLS
 * policy having to expose individual sellers', customers', or orders' data.
 */
export async function getPlatformImpact() {
  const { data, error } = await supabase.rpc('get_platform_impact');
  if (error) return { success: false, error: error.message };
  // rpc() returns an array with one row for a `returns table (...)` function
  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: true,
    sellersEmployed: Number(row?.sellers_employed || 0),
    totalSales: Number(row?.total_sales || 0),
    totalCommissionsPaid: Number(row?.total_commissions_paid || 0),
    totalEducationFund: Number(row?.total_education_fund || 0),
  };
}
