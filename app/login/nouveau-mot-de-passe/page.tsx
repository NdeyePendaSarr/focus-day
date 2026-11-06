"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { messageFr } from "@/lib/authMessages";
import { passwordHint, passwordProblem } from "@/lib/password";
import AuthShell from "@/components/AuthShell";

type Etat = "verification" | "sans-session" | "pret";

/**
 * Mot de passe oublié, étape 2 : choisir le nouveau mot de passe.
 *
 * On arrive ici depuis /auth/callback, qui a échangé le code du lien
 * contre une session. Sans session (page ouverte directement, lien
 * expiré), on ne peut rien changer : on renvoie vers une nouvelle demande.
 *
 * Après l'enregistrement, déconnexion puis retour à la connexion : on se
 * reconnecte avec le nouveau mot de passe, ce qui prouve qu'il est bon.
 */
export default function NouveauMotDePassePage() {
  const [etat, setEtat] = useState<Etat>("verification");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  // Après une tentative trop courte, l'indication passe en rouge.
  const [pwdTried, setPwdTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await getSupabase().auth.getUser();
        setEmail(data.user?.email ?? null);
        setEtat(data.user ? "pret" : "sans-session");
      } catch {
        setEtat("sans-session");
      }
    })();
  }, []);

  const submit = async () => {
    if (!password || busy) return;
    const probleme = passwordProblem(password);
    if (probleme) {
      setPwdTried(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const auth = getSupabase().auth;
      const { error } = await auth.updateUser({ password });
      if (error) throw new Error(messageFr(error.message));
      await auth.signOut();
      window.location.href = "/login?auth=mot-de-passe-change";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="auth-title">Nouveau mot de passe</h2>

      {etat === "verification" && <p className="auth-hint">Un instant…</p>}

      {etat === "sans-session" && (
        <>
          <p role="alert" className="auth-msg auth-msg-error auth-msg-top">
            Ce lien a expiré, a déjà servi ou a été ouvert dans un autre
            navigateur.
          </p>
          <Link href="/login/mot-de-passe-oublie" className="btn-hero auth-submit">
            Demander un nouveau lien
          </Link>
        </>
      )}

      {etat === "pret" && (
        <>
          <p className="auth-hint">
            {email ? (
              <>
                Choisis le nouveau mot de passe de <strong>{email}</strong>.
              </>
            ) : (
              "Choisis ton nouveau mot de passe."
            )}
          </p>

          <label className="field-label" htmlFor="new-pwd">
            Nouveau mot de passe
          </label>
          <div className="auth-pwd">
            <input
              id="new-pwd"
              type={visible ? "text" : "password"}
              className="field"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-describedby="new-pwd-hint"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                // L'erreur parlait de l'ancienne saisie : l'indication sous
                // le champ prend le relais pendant la frappe.
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
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
          <p
            id="new-pwd-hint"
            className={`auth-pwd-hint${pwdTried && passwordProblem(password) ? " auth-pwd-hint-error" : ""}`}
            aria-live="polite"
          >
            {passwordHint(password)}
          </p>

          {error && <p role="alert" className="auth-msg auth-msg-error">{error}</p>}
          <button className="btn-hero auth-submit" onClick={submit} disabled={busy || !password}>
            {busy ? "Un instant…" : "Enregistrer le mot de passe"}
          </button>
        </>
      )}

      <p className="auth-back">
        <Link href="/login" className="link-quiet">
          Retour à la connexion
        </Link>
      </p>
    </AuthShell>
  );
}
