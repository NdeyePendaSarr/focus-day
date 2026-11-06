"use client";

import { useState } from "react";

/**
 * Météo du jour — idée reprise du sujet d'examen (géoloc + température).
 * Open-Meteo est gratuit et sans clé API. Sert de contexte à la
 * planification (« il pleut → peut-être décaler la sortie »).
 */
type Weather = {
  temp: number;
  code: number;
  label: string;
  city?: string;
};

const CODE_LABEL: Record<number, string> = {
  0: "Ciel dégagé",
  1: "Peu nuageux",
  2: "Partiellement nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  61: "Pluie faible",
  63: "Pluie modérée",
  65: "Forte pluie",
  80: "Averses",
  95: "Orage",
};

export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "denied" | "error" | "ok">("idle");

  const load = () => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
          );
          // Sans ce contrôle, une réponse d'erreur (quota, panne) était lue
          // comme une météo : « Ciel dégagé », 0 °C.
          if (!res.ok) throw new Error(`Open-Meteo : ${res.status}`);
          const data = await res.json();
          if (typeof data.current?.temperature_2m !== "number") throw new Error("réponse incomplète");
          const code = data.current?.weather_code ?? 0;
          setWeather({
            temp: Math.round(data.current?.temperature_2m ?? 0),
            code,
            label: CODE_LABEL[code] ?? "—",
          });
          setStatus("ok");
        } catch {
          setStatus("error");
        }
      },
      () => setStatus("denied"),
      { timeout: 8000 }
    );
  };

  // Pas de déclenchement auto : on attend un clic explicite de l'utilisateur.
  // Meilleure UX (il comprend pourquoi on demande sa position) et plus fiable.
  return { weather, status, load };
}
