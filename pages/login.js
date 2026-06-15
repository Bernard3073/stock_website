import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { signIn, getProviders, useSession } from "next-auth/react";
import { useEffect } from "react";

export async function getServerSideProps() {
  const providers = await getProviders();
  return {
    props: {
      hasGoogle: Boolean(providers?.google),
      providerError: null
    }
  };
}

export default function LoginPage({ hasGoogle }) {
  const router = useRouter();
  const { status } = useSession();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (mode === "signup") {
      setBusy(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || null })
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Sign-up failed.");
          setBusy(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-up failed.");
        setBusy(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/"
    });

    setBusy(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    if (result?.ok) router.replace("/");
  }

  async function handleGoogle() {
    setBusy(true);
    setError("");
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <>
      <Head>
        <title>{mode === "signin" ? "Sign in" : "Create account"} · Market Current</title>
      </Head>

      <main className="auth-shell">
        <div className="auth-card">
          <Link href="/" className="auth-brand">
            <span className="auth-brand-dot" aria-hidden="true">●</span> Market Current
          </Link>

          <h1 className="auth-title">
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="auth-subtitle">
            {mode === "signin"
              ? "Sign in to load your saved watchlist."
              : "Sign up to keep your watchlist across devices."}
          </p>

          {hasGoogle ? (
            <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
          ) : (
            <div className="auth-google-disabled">
              Google sign-in is not configured. Set <code>GOOGLE_CLIENT_ID</code> and{" "}
              <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code> to enable it.
            </div>
          )}

          <div className="auth-divider"><span>or</span></div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="auth-field">
                <span>Name (optional)</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  disabled={busy}
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={busy}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : 1}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                disabled={busy}
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-toggle">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
              }}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>

          <Link href="/" className="auth-back">← Back to dashboard</Link>
        </div>
      </main>
    </>
  );
}
