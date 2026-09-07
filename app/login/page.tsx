"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

/**
 * Les messages de Supabase arrivent en anglais et parlent au développeur.
 * On les traduit en phrases qui disent quoi faire.
 */
function messageFr(brut: string): string {
  const m = brut.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered")) return "Un compte existe déjà avec cette adresse.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit faire au moins 6 caractères.";
  if (m.includes("email not confirmed"))
    return "Adresse non confirmée. Ouvre le lien reçu par email.";
  if (m.includes("unable to validate email")) return "Cette adresse email n'est pas valide.";
  if (m.includes("failed to fetch")) return "Connexion impossible. Vérifie ton réseau.";
  return brut;
}

/**
 * Hauteurs figées, jamais aléatoires : une valeur tirée au rendu
 * différerait entre le serveur et le navigateur et casserait l'hydratation.
 * Chaque paire évoque une journée — prévu à gauche, réalisé à droite.
 */
const JOURS = [
  { prevu: 62, reel: 48 },
  { prevu: 40, reel: 44 },
  { prevu: 78, reel: 55 },
  { prevu: 54, reel: 54 },
  { prevu: 88, reel: 70 },
  { prevu: 46, reel: 60 },
  { prevu: 70, reel: 38 },
];

function Illustration() {
  return (
    <div className="auth-art" aria-hidden="true">
      {JOURS.map((j, i) => (
        <div key={i} className="auth-day">
          <span
            className="auth-bar auth-bar-plan"
            style={{ ["--h" as string]: `${j.prevu}%`, animationDelay: `${i * 90}ms` }}
          />
          <span
            className="auth-bar auth-bar-real"
            style={{ ["--h" as string]: `${j.reel}%`, animationDelay: `${i * 90 + 45}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

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
    if (!email || !password || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const auth = getSupabase().auth;
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw new Error(messageFr(error.message));
        window.location.href = "/";
      } else {
        const { data, error } = await auth.signUp({ email, password });
        if (error) throw new Error(messageFr(error.message));
        if (data.session) {
          window.location.href = "/";
        } else {
          setInfo("Compte créé. Ouvre le lien de confirmation reçu par email.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setBusy(false);
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main className="auth-shell">
      {/* Panneau de gauche : ce que fait le produit, montré plutôt qu'écrit. */}
      <section className="auth-side">
        <div>
          <p className="auth-logo">
            Focus<span style={{ color: "var(--color-brand)" }}>Day</span>
          </p>
          <h1 className="auth-claim">
            Ce que tu avais prévu.
            <br />
            Ce que tu as vraiment fait.
          </h1>
          <p className="auth-sub">
            FocusDay mesure l&apos;écart entre les deux, jour après jour, pour
            comprendre comment tu travailles réellement.
          </p>
        </div>

        <Illustration />

        <p className="auth-legend">
          <span className="auth-dot auth-dot-plan" /> prévu
          <span className="auth-dot auth-dot-real" /> réalisé
        </p>
      </section>

      {/* Panneau de droite : le formulaire, et rien d'autre. */}
      <section className="auth-form-side">
        <div className="auth-card card-surface">
          <p className="auth-logo auth-logo-mobile">
            Focus<span style={{ color: "var(--color-brand)" }}>Day</span>
          </p>

          <h2 className="auth-title">
            {mode === "signin" ? "Content de te revoir" : "Crée ton compte"}
          </h2>
          <p className="auth-hint">
            {mode === "signin"
              ? "Connecte-toi pour retrouver tes journées."
              : "Quelques secondes, et tu peux planifier ta première journée."}
          </p>

          {currentEmail && (
            <div className="auth-session">
              <span>
                Déjà connectée : <strong>{currentEmail}</strong>
              </span>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button className="chip" onClick={() => router.push("/")}>
                  Continuer
                </button>
                <button className="chip chip-rose" onClick={signOut}>
                  Se déconnecter
                </button>
              </div>
            </div>
          )}

          <label className="field-label" htmlFor="auth-email">
            Adresse email
          </label>
          <input
            id="auth-email"
            type="email"
            className="field"
            autoComplete="email"
            placeholder="toi@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <label className="field-label" htmlFor="auth-pwd" style={{ marginTop: "0.9rem" }}>
            Mot de passe
          </label>
          <div className="auth-pwd">
            <input
              id="auth-pwd"
              type={visible ? "text" : "password"}
              className="field"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "6 caractères minimum" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {visible ? "Masquer" : "Afficher"}
            </button>
          </div>

          {error && <p className="auth-msg auth-msg-error">{error}</p>}
          {info && <p className="auth-msg auth-msg-ok">{info}</p>}

          <button
            className="btn-primary auth-submit"
            onClick={submit}
            disabled={busy || !email || !password}
          >
            {busy
              ? "Un instant…"
              : mode === "signin"
                ? "Se connecter"
                : "Créer mon compte"}
          </button>

          <p className="auth-switch">
            {mode === "signin" ? "Pas encore de compte ?" : "Tu as déjà un compte ?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
            >
              {mode === "signin" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
