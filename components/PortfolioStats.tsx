import type { GoalSummary } from "@/lib/portfolio";
import { plural, consacre, formatPeriod } from "@/lib/portfolio";
import { formatDuration } from "@/lib/time";

/**
 * Les chiffres d'un parcours : heures consacrées en tête, puis séances,
 * jours actifs, notes et période. Partagé par la carte et le détail.
 */
export default function PortfolioStats({ s, large = false }: { s: GoalSummary; large?: boolean }) {
  return (
    <div>
      <p className="pf-hours" style={large ? { fontSize: "2.4rem" } : undefined}>
        {formatDuration(s.minutes)}
        <span className="pf-hours-unit"> {consacre(s.minutes)}</span>
      </p>
      <p className="pf-facts">
        {plural(s.sessions.length, "séance", "séances")} · {plural(s.activeDays, "jour actif", "jours actifs")} ·{" "}
        {plural(s.notes, "note", "notes")}
      </p>
      <p className="pf-period">{formatPeriod(s.firstDate, s.lastDate)}</p>
    </div>
  );
}
