import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

function mapUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    role: "User",
  };
}

export function isSupabaseEnabled() {
  return supabaseConfigured;
}

export async function restoreSupabaseUser() {
  if (!supabase) return null;
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  if (!session?.user) return null;
  return {
    user: mapUser(session.user),
    sessionToken: session.access_token,
  };
}

export async function signupWithSupabase(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    user: mapUser(data.user),
    sessionToken: data.session?.access_token || "",
    requiresEmailConfirmation: !data.session,
    message: data.session
      ? "Account created successfully."
      : "Account created. Check your email to confirm your account before signing in.",
  };
}

export async function loginWithSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    user: mapUser(data.user),
    sessionToken: data.session?.access_token || "",
  };
}

export async function requestSupabasePasswordReset(email) {
  const redirectTo = import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    message: "Password reset email sent. Open the email link to choose a new password.",
  };
}

export async function logoutSupabaseUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}
