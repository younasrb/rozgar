// auth.js
// Signup / login functions. Every user gets a role: 'customer' | 'employee' | 'admin'.

import { supabase } from './supabaseClient';

/**
 * Sign up a new user and create their profile row with a role.
 */
export async function signUp(email, password, fullName, role, city = null) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered')) {
      return {
        success: false,
        alreadyExists: true,
        error: 'This email already has an account. Please log in instead.',
      };
    }
    return { success: false, error: authError.message };
  }

  // Supabase returns no error but an empty `identities` array when the email
  // already belongs to an account (this prevents leaking which emails exist).
  if (authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
    return {
      success: false,
      alreadyExists: true,
      error: 'This email already has an account. Please log in instead.',
    };
  }

  // Create matching profile row in `users` table
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    full_name: fullName,
    role,
    city,
  });

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  return { success: true, user: authData.user };
}

/**
 * Log in an existing user.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials')) {
      // Supabase intentionally doesn't reveal whether the email exists or the
      // password is wrong (this prevents attackers from discovering which
      // emails are registered), so we show one honest, helpful message.
      return {
        success: false,
        invalidCredentials: true,
        error: "We couldn't log you in. Double-check your email and password, or sign up if you don't have an account yet.",
      };
    }
    return { success: false, error: error.message };
  }

  // Fetch role along with the session
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  return { success: true, user: data.user, profile };
}

/**
 * Log out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { success: !error, error: error?.message };
}

/**
 * Get the currently logged-in user's profile (id + role), or null.
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}
