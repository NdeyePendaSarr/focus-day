"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { messageFr } from "@/lib/authMessages";
import { passwordHint, passwordProblem } from "@/lib/password";
import AuthShell from "@/components/AuthShell";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  // Une tentative avec un mot de passe trop court : l'indication sous le
  // champ passe en rouge, au lieu d'un second message qui la répète.
  const [pwdTried, setPwdTried] = useState(false);
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
    // Retour d'un lien de confirmation d'inscription : l'adresse est
    // confirmée, aucune session n'a été ouverte (voir auth/callback).
    if (raison === "confirmee") {
      setMode("signin");
      setInfo("Adresse confirmée. Connecte-toi pour commencer.");
    }
    if (raison === "mot-de-passe-change") {
      setMode("signin");
      setInfo("Mot de passe changé. Connecte-toi avec le nouveau.");
    }
    if (raison === "lien-invalide")
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
    // À l'inscription seulement : un compte existant peut avoir un mot de
    // passe plus court, créé avant la règle des 8 caractères.
    const probleme = mode === "signup" ? passwordProblem(password) : null;
    if (probleme) {
      setPwdTried(true);
      return;
    }
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
    <AuthShell>
      <h2 className="auth-title">
        {mode === "signin" ? "Te revoilà" : "Crée ton compte"}
      </h2>
      <p className="auth-hint">
        {mode === "signin"
          ? "Connecte-toi pour retrouver tes séances et tes parcours."
          : "Quelques secondes, et tu peux planifier ta première séance."}
      </p>

      {/* Les messages d'information (adresse confirmée, email envoyé…)
          en tête du formulaire : sous les champs, ils passaient sous la
          ligne de flottaison sur mobile. Les erreurs restent près du
          bouton, là où l'action vient d'échouer. */}
      {info && <p className="auth-msg auth-msg-ok auth-msg-top">{info}</p>}

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
          placeholder="••••••••"
          aria-describedby={mode === "signup" ? "auth-pwd-hint" : undefined}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            // L'erreur parlait de l'ancienne saisie : l'indication sous
            // le champ prend le relais pendant la frappe.
            setError(null);
          }}
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
      {mode === "signup" && (
        <p
          id="auth-pwd-hint"
          className={`auth-pwd-hint${pwdTried && passwordProblem(password) ? " auth-pwd-hint-error" : ""}`}
          aria-live="polite"
        >
          {passwordHint(password)}
        </p>
      )}
      {mode === "signin" && (
        <p className="auth-forgot">
          <Link href="/login/mot-de-passe-oublie" className="link-quiet">
            Mot de passe oublié ?
          </Link>
        </p>
      )}

      {error && <p className="auth-msg auth-msg-error">{error}</p>}
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
    </AuthShell>
  );
}
