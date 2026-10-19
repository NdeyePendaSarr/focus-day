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
 * Aperçu d'une carte de portfolio : ce que le produit produit, montré
 * plutôt qu'écrit. Exemple figé, purement illustratif (aria-hidden) ;
 * les chiffres restent des heures « consacrées », jamais « mesurées ».
 */
function PortfolioStack() {
  // Trois cartes posées comme sur une table : l'image de la page, c'est
  // le produit lui-même. Les cartes sont du « papier » : couleurs fixes,
  // identiques en thème clair et sombre.
  return (
    <div className="auth-stack" aria-hidden="true">
      <div className="stack-card stack-back">
        <p className="stack-title">
          Google Data Analytics <span className="stack-done">Terminé</span>
        </p>
        <p className="stack-hours">
          {"64 h "}
          <span className="stack-unit">consacrées</span>
        </p>
      </div>

      <div className="stack-card stack-main">
        {/* « Exemple » : ces chiffres sont inventés et ne doivent pas
            passer pour ceux de quelqu'un. */}
        <p className="stack-label">Exemple de portfolio</p>
        <p className="stack-title">Certification Power BI</p>
        <p className="stack-hours stack-hours-lg">
          {"48 h "}
          <span className="stack-unit">consacrées</span>
        </p>
        <p className="stack-facts">22 séances · 19 jours actifs · 14 notes</p>
      </div>

      <div className="stack-card stack-note">
        <p className="stack-label">Ce que j&apos;en retiens</p>
        <p className="stack-quote">
          « CALCULATE modifie le contexte de filtre : revoir ALL et REMOVEFILTERS. »
        </p>
      </div>
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
    const raison = new URLSearchParams(window.location.search).get("auth");
    // Un lien de confirmation ne sert qu'une fois, et il est souvent
    // ouvert avant l'utilisateur par un antivirus de messagerie ou un
    // aperçu de lien. Dans ce cas la confirmation a bien eu lieu : le
    // message doit inviter à se connecter, pas annoncer un échec.
    if (raison === "lien-expire" || raison === "lien-invalide")
      setInfo(
        "Ce lien a déjà servi — c'est fréquent, les messageries les ouvrent " +
          "automatiquement. Ton adresse est confirmée : connecte-toi normalement."
      );

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
        const { data, error } = await auth.signUp({
          email,
          password,
          // Sans cette adresse, Supabase utilise son "Site URL" global.
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
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
    <div className="auth-split">
      {/* Colonne visuelle pleine hauteur, en bleu profond : la promesse,
          puis le produit lui-même en guise d'image. C'est la première
          chose que voit quelqu'un à qui l'on donne le lien. */}
      <aside className="auth-panel">
        <p className="auth-logo auth-logo-light">
          <span className="auth-dot-logo" />
          Focus<span className="auth-logo-day">Day</span>
        </p>

        <div className="auth-panel-body">
          <span className="eyebrow eyebrow-light">Carnet d&apos;apprentissage</span>
          {/* Coupure maîtrisée : la virgule finit la première ligne, et seul
              « gardes » est en couleur. */}
          <h1 className="auth-claim auth-claim-light">
            Ce que tu apprends,
            <br /> tu le <span className="accent-light">gardes</span>.
          </h1>
          <p className="auth-sub auth-sub-light">
            Note tes séances et ce que tu en retiens. FocusDay en fait un
            portfolio que tu peux montrer.
          </p>

          <PortfolioStack />
        </div>
      </aside>

    <main className="auth-form-zone">
      {/* Sur mobile, la colonne visuelle disparaît : le logo revient ici. */}
      <div className="auth-topbar auth-topbar-mobile">
        <p className="auth-logo">
          <span className="auth-dot-logo" />
          Focus<span style={{ color: "var(--color-brand)" }}>Day</span>
        </p>
      </div>

      <section className="auth-form-side">
        <div className="auth-card card-surface">
          {/* Sur mobile le panneau de gauche disparaît : on en garde
              l'essentiel ici, sans quoi la carte flotte sur du vide. */}
          <div className="auth-mobile-head">
            <p className="auth-claim-sm">
              {/* Espaces insécables : « tu le gardes » ne se coupe jamais,
                  sinon « tu » reste orphelin en fin de ligne. */}
              Ce que tu apprends,
              <br /> tu{" "}le{" "}<span className="accent">gardes</span>.
            </p>
          </div>

          <h2 className="auth-title">
            {mode === "signin" ? "Te revoilà" : "Crée ton compte"}
          </h2>
          <p className="auth-hint">
            {mode === "signin"
              ? "Connecte-toi pour retrouver tes séances et tes parcours."
              : "Quelques secondes, et tu peux planifier ta première séance."}
          </p>

          {currentEmail && (
            <div className="auth-session">
              <span>
                Session ouverte : <strong>{currentEmail}</strong>
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
            className="btn-hero auth-submit"
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
    </div>
  );
}