import AuthPanel from "../components/auth/AuthPanel.jsx";
import Footer from "../components/layout/Footer.jsx";
import Header from "../components/layout/Header.jsx";
import GameVisual from "../components/home/GameVisual.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

export default function HomePage() {
  const { t } = useI18n();

  return (
    <div className="home-page">
      <Header />
      <main className="home-main">
        <section className="hero" aria-label={t("home.label")}>
          <GameVisual />
          <AuthPanel />
        </section>

        <section className="home-info" aria-label={t("home.infoLabel")}>
          <article className="info-panel" id="about-game">
            <p className="info-kicker">{t("home.aboutKicker")}</p>
            <h2>{t("home.aboutTitle")}</h2>
            <p>{t("home.aboutText")}</p>
          </article>
          <article className="info-panel" id="how-to-play">
            <p className="info-kicker">{t("home.howKicker")}</p>
            <h2>{t("home.howTitle")}</h2>
            <p>{t("home.howText")}</p>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
}
