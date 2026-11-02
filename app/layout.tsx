import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

// Polices versionnées dans app/fonts (licence OFL jointe), et non plus
// téléchargées chez Google au moment du build : le 2 novembre 2026, la CI
// a échoué sur « next/font/google queries have exactly one entry » alors
// que le code n'avait pas changé. Le build ne dépend plus du réseau.
// Fichiers variables, sous-ensemble latin (français compris).

// Titres : très gras et très serrés.
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  weight: "500 800",
  variable: "--font-jakarta",
  display: "swap",
});
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Ce qui s'affiche dans l'onglet et dans l'aperçu d'un lien partagé
  // (WhatsApp, etc.) : la même promesse que la page de connexion.
  title: "FocusDay — ce que tu apprends, tu le gardes",
  description:
    "Carnet de suivi d'apprentissage : note tes séances de formation et ce que tu en retiens. Pour chaque parcours, retrouve les heures que tu y as consacrées et tes notes, en portfolio.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Les variables de police sur <html> et non sur <body> : --font-display
    // et --font-body sont définies sur :root et y lisent --font-jakarta et
    // --font-inter. Posées sur <body>, elles étaient invisibles depuis
    // :root, les deux polices restaient vides et l'app s'affichait en
    // police système.
    <html lang="fr" className={`${jakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
