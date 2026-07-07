import heroImage from "../../assets/home-hero-placeholder.png";

const routeStats = [
  { value: "45", label: "символів тунелю" },
  { value: "9", label: "типів предметів" },
  { value: "5", label: "гравців максимум" }
];

export default function GameVisual() {
  return (
    <div className="game-visual">
      <img src={heroImage} alt="" className="hero-image" aria-hidden="true" />
      <div className="visual-scrim" aria-hidden="true" />
      <div className="hero-copy">
        <p className="eyebrow">Noir cyberpunk card escape</p>
        <h1>Eclipcity</h1>
        <p className="tagline">
          2150 рік. Команди втікачів пробиваються до тунелю за межі міста,
          граючи картами предметів, ризиком і останнім запасом сміливості.
        </p>
        <div className="route-stats" aria-label="Ключові параметри гри">
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
