import { useI18n } from "../../i18n/I18nProvider.jsx";

export default function Header() {
  const { t } = useI18n();

  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Eclipcity home">
        Eclipcity
      </a>
      <nav className="main-nav" aria-label={t("nav.main")}>
        <a href="#about-game">{t("nav.about")}</a>
        <a href="#how-to-play">{t("nav.howToPlay")}</a>
      </nav>
      <div className="header-slot" aria-hidden="true">
        <span>2150</span>
      </div>
    </header>
  );
}
