"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  // Si une session existe déjà, on propose de continuer ou de se déconnecter.
  // C'est aussi ce qui permet de tester la RLS avec deux comptes.
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await getSupabase().auth.getUser();
        setCurrentEmail(data.user?.email ?? null);
      } catch {
        setError("Supabase n'est pas configuré. Vérifie .env.local.");
      }
    })();
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const auth = getSupabase().auth;
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        // Navigation dure : recharge complètement l'app avec la nouvelle
        // session. Un router.push laisserait vivre des composants montés
        // avec l'ancien état d'authentification.
        window.location.href = "/";
      } else {
        const { data, error } = await auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (data.session) {
          window.location.href = "/";
        } else {
          setInfo("Compte créé. Vérifie ta boîte mail pour confirmer l'adresse.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    // Rechargement complet : sans ça, des composants encore montés
    // continueraient d'interroger Supabase sans session et
    // déclencheraient des erreurs.
    window.location.href = "/login";
  };

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "4rem 1.25rem" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          fontWeight: 700,
          marginBottom: "0.35rem",
        }}
      >
        Focus<span style={{ color: "var(--color-brand)" }}>Day</span>
      </h1>
      <p style={{ color: "var(--text-soft)", fontSize: "0.92rem", marginBottom: "1.75rem" }}>
        {mode === "signin" ? "Connecte-toi pour retrouver tes journées." : "Crée ton compte."}
      </p>

      {currentEmail && (
        <div className="card-surface" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
          <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
            Déjà connectée : <strong>{currentEmail}</strong>
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="chip" onClick={() => router.push("/")}>
              Continuer
            </button>
            <button className="chip chip-rose" onClick={signOut}>
              Se déconnecter
            </button>
          </div>
        </div>
      )}

      <div className="card-surface" style={{ padding: "1.25rem", display: "grid", gap: "0.85rem" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ padding: "0.6rem 0.75rem", borderRadius: 8 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && email && password && !busy) void submit();
            }}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            style={{ padding: "0.6rem 0.75rem", borderRadius: 8 }}
          />
        </label>

        {error && (
          <p style={{ color: "var(--color-rose)", fontSize: "0.85rem" }}>{error}</p>
        )}
        {info && <p style={{ color: "var(--color-mint)", fontSize: "0.85rem" }}>{info}</p>}

        <button
          className="btn-primary"
          onClick={submit}
          disabled={busy || !email || !password}
        >
          {busy ? "…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </button>

        <button
          className="chip"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "signin" ? "Pas encore de compte ?" : "J'ai déjà un compte"}
        </button>
      </div>
    </main>
  );
}
