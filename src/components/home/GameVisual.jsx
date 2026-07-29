import heroImage from "../../assets/home-hero-placeholder.png";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export default function GameVisual() {
  const { t } = useI18n();
  const routeStats = [
    { value: "45", label: t("home.statTiles") },
    { value: "9", label: t("home.statItems") },
    { value: "5", label: t("home.statPlayers") }
  ];

  return (
    <div className="game-visual">
      <img src={heroImage} alt="" className="hero-image" aria-hidden="true" />
      <div className="visual-scrim" aria-hidden="true" />
      <div className="hero-copy">
        <p className="eyebrow">Noir cyberpunk card escape</p>
        <h1>Eclipcity</h1>
        <p className="tagline">{t("home.tagline")}</p>
        <div className="route-stats" aria-label={t("home.statsLabel")}>
          {routeStats.map((stat) => (
            <div className="stat-chip" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
