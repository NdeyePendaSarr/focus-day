"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { messageFr } from "@/lib/authMessages";
import AuthShell from "@/components/AuthShell";

/**
 * Mot de passe oublié, étape 1 : demander l'adresse et envoyer le lien.
 *
 * Le lien de l'email passe par /auth/callback, qui ouvre une session puis
 * renvoie vers /login/nouveau-mot-de-passe. Supabase (PKCE) garde une clé
 * dans ce navigateur : le lien doit être ouvert ici, pas sur un autre
 * appareil — d'où la consigne affichée après l'envoi.
 */
export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Retour d'un lien expiré, déjà utilisé, ou ouvert dans un autre navigateur.
    if (new URLSearchParams(window.location.search).get("lien") === "expire") setExpired(true);
  }, []);

  const submit = async () => {
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/login/nouveau-mot-de-passe`,
      });
      if (error) throw new Error(messageFr(error.message));
      setExpired(false);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="auth-title">Mot de passe oublié</h2>

      {sent ? (
        <>
          {/* Même message que l'adresse ait un compte ou non : sinon ce
              formulaire dirait à n'importe qui qui est inscrit. */}
          <p className="auth-msg auth-msg-ok auth-msg-top">
            Si un compte existe pour <strong>{email}</strong>, un lien vient de partir.
            Ouvre-le dans ce navigateur : il ne sert qu&apos;une fois.
          </p>
          <p className="auth-hint">
            Rien reçu au bout de quelques minutes ? Regarde dans les courriers
            indésirables, ou vérifie l&apos;adresse.
          </p>
          <button
            type="button"
            className="link-quiet"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >
            Utiliser une autre adresse
          </button>
        </>
      ) : (
        <>
          <p className="auth-hint">
            Indique l&apos;adresse de ton compte : tu recevras un lien pour choisir
            un nouveau mot de passe.
          </p>

          {expired && (
            <p role="alert" className="auth-msg auth-msg-error auth-msg-top">
              Ce lien a expiré, a déjà servi ou a été ouvert dans un autre
              navigateur. Demande-en un nouveau ci-dessous.
            </p>
          )}

          <label className="field-label" htmlFor="reset-email">
            Adresse email
          </label>
          <input
            id="reset-email"
            type="email"
            className="field"
            autoComplete="email"
            placeholder="toi@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          {error && <p role="alert" className="auth-msg auth-msg-error">{error}</p>}
          <button className="btn-hero auth-submit" onClick={submit} disabled={busy || !email}>
            {busy ? "Un instant…" : "Envoyer le lien"}
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
