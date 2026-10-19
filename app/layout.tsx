import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

// Titres : très gras et très serrés. next/font l'auto-héberge au build,
// aucune dépendance npm ajoutée.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FocusDay — ta journée, pilotée par le temps",
  description:
    "Planifie tes objectifs par créneaux, reçois des rappels quand l'heure approche, et débriefe ta journée. Un coach de productivité, pas une todo-list.",
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
