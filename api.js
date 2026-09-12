// api.js
// The core functions from the PRD/M3 task sheet, plus the seller-assigned-product
// model (each approved seller specializes in ONE product) and walk-in sale recording.

import { supabase } from './supabaseClient';

/**
 * Create a new seller application (Pending by default). The seller picks which
 * product they'd like to sell at signup — Admin can approve it as-is or assign
 * a different one.
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
 * Runs as ONE atomic database transaction (via the place_order Postgres
 * function — see schema-seller-assignment-fix.sql) so an order can never end
 * up without its matching commission row. The server re-validates that the
 * seller is an approved employee actually assigned to sell this exact product,
 * and computes the commission math itself — none of that is trusted from the client.
 *
 * walkInCustomer is optional — pass { customerName, customerPhone } when a seller
 * is recording a door-to-door / in-person sale from their own dashboard.
 */
export async function placeOrder(customerId, sellerId, productId, walkInCustomer = {}) {
  const { data, error } = await supabase.rpc('place_order', {
    p_customer_id: customerId,
    p_seller_id: sellerId,
    p_product_id: productId,
    p_customer_name: walkInCustomer.customerName || null,
    p_customer_phone: walkInCustomer.customerPhone || null,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, order: data.order, commission: data.commission };
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
 * Get the logged-in seller's own application (to check Pending/Approved/Rejected
 * status, and their assigned/requested product).
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

export async function getPendingApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('status', 'Pending');

  if (error) return { success: false, error: error.message };
  return { success: true, applications: data };
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
 * Get approved sellers who are actually assigned to sell a specific product — used at
 * checkout to assign an order to a seller who really sells that item. Pass no argument
 * to get every approved seller regardless of product (used by the employee/admin views).
 * Only returns sellers whose latest application status is 'Approved'
 * (via the get_approved_sellers Postgres function — see schema-seller-assignment-fix.sql).
 */
export async function getApprovedSellers(productId) {
  const { data, error } = await supabase.rpc('get_approved_sellers', {
    p_product_id: productId || null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, sellers: data };
}

/**
 * Record an admin action so every admin can see who did what.
 */
export async function logAdminAction(adminId, adminName, action, details = null) {
  const { error } = await supabase.from('admin_logs').insert({
    admin_id: adminId,
    admin_name: adminName,
    action,
    details,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Get the full admin activity log (newest first) — visible to all admins.
 */
export async function getAdminLogs() {
  const { data, error } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, logs: data };
}

/**
 * Get the list of current admin accounts.
 */
export async function getAdmins() {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, created_at')
    .eq('role', 'admin');

  if (error) return { success: false, error: error.message };
  return { success: true, admins: data };
}

/**
 * Create a new admin account. Only call this from the Admin dashboard.
 *
 * IMPORTANT LIMITATION: Supabase's client-side signUp() switches the browser's
 * active session to the newly created account. This function immediately signs
 * that new session back out so the acting admin can log back in — there is a
 * brief moment where the browser is "logged in" as the new admin before that
 * happens. This is a known trade-off of not having a backend server; a fully
 * seamless version would use a Supabase Edge Function with a service-role key.
 */
export async function createAdminAccount(email, password, fullName) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return { success: false, error: 'This email already has an account.' };
    }
    return { success: false, error: authError.message };
  }

  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    full_name: fullName,
    role: 'admin',
  });

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  // Sign the new admin's session back out — the acting admin will need to log in again.
  await supabase.auth.signOut();

  return { success: true, newAdminId: authData.user.id };
}
