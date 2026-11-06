"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { getSupabase } from "@/lib/supabase";

// Dans l'ordre du produit depuis le pivot : la journée, puis ce à quoi
// elle contribue (parcours, portfolio), puis le regard en arrière.
// Archives est accessible depuis l'historique : on s'en sert rarement.
const LINKS = [
  { href: "/", label: "Ma journée" },
  { href: "/parcours", label: "Parcours" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/history", label: "Historique" },
  { href: "/dashboard", label: "Tableau de bord" },
];

/** Actif aussi sur les sous-pages (/portfolio/[id]) ; « / » seulement en exact. */
const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

export default function NavBar() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectee, setConnectee] = useState(false);

  // Le bouton n'apparaît qu'en mode Supabase et une fois la session lue :
  // en mode localStorage il n'y a personne à déconnecter.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "supabase") return;
    void (async () => {
      try {
        const { data } = await getSupabase().auth.getUser();
        setConnectee(Boolean(data.user));
      } catch {
        setConnectee(false);
      }
    })();
  }, []);

  const seDeconnecter = async () => {
    await getSupabase().auth.signOut();
    // Rechargement complet : sans lui, des composants encore montés
    // continueraient d'interroger Supabase sans session.
    window.location.href = "/login";
  };

  // Referme le menu à chaque changement de page
  useEffect(() => setMenuOpen(false), [path]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "color-mix(in srgb, var(--bg) 85%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="page-shell"
        style={{
          paddingTop: "0.9rem",
          paddingBottom: "0.9rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--color-amber)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-amber) 25%, transparent)",
            }}
          />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>
            Focus<span style={{ color: "var(--color-brand)" }}>Day</span>
          </span>
        </Link>

        {/* Liens complets — masqués sur petit écran (voir .nav-links dans globals.css) */}
        <nav className="nav-links" style={{ alignItems: "center", gap: 4 }}>
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                // Annoncé « page actuelle » : sans cela, seuls la couleur
                // et le gras disaient où l'on est.
                aria-current={active ? "page" : undefined}
                style={{
                  fontSize: "0.88rem",
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--color-brand)" : "var(--text-soft)",
                  padding: "0.45rem 0.75rem",
                  borderRadius: 8,
                  background: active ? "var(--bg-3)" : "transparent",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {l.label}
              </Link>
            );
          })}
          {connectee && (
            <button
              onClick={seDeconnecter}
              className="link-quiet"
              style={{ marginLeft: 10, fontSize: "0.85rem" }}
            >
              Se déconnecter
            </button>
          )}
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Passer en clair" : "Passer en sombre"}
            className="btn-ghost"
            style={{ marginLeft: 6, padding: "0.45rem 0.7rem", fontSize: "1rem", lineHeight: 1 }}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </nav>

        {/* Bouton burger — visible seulement sur petit écran */}
        <button
          className="nav-burger btn-ghost"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          style={{ padding: "0.5rem 0.65rem", fontSize: "1.1rem", lineHeight: 1 }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Panneau déroulant du menu mobile */}
      {menuOpen && (
        <div
          className="nav-mobile-panel"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--bg-2)",
            padding: "0.6rem 1.25rem 1rem",
            display: "grid",
            gap: 4,
            animation: "var(--animate-slide-up)",
          }}
        >
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                // Annoncé « page actuelle » : sans cela, seuls la couleur
                // et le gras disaient où l'on est.
                aria-current={active ? "page" : undefined}
                style={{
                  fontSize: "0.95rem",
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--color-brand)" : "var(--text-soft)",
                  padding: "0.65rem 0.75rem",
                  borderRadius: 8,
                  background: active ? "var(--bg-3)" : "transparent",
                }}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={toggle}
            className="btn-ghost"
            style={{ justifySelf: "start", marginTop: 4 }}
          >
            {theme === "dark" ? "☀ Passer en clair" : "☾ Passer en sombre"}
          </button>
          {connectee && (
            <button
              onClick={seDeconnecter}
              className="link-quiet"
              style={{ justifySelf: "start", marginTop: 6, padding: "0.4rem 0.75rem" }}
            >
              Se déconnecter
            </button>
          )}
        </div>
      )}
    </header>
  );
}
