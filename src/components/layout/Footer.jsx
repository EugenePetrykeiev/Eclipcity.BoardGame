import { useI18n } from "../../i18n/I18nProvider.jsx";
import packageMetadata from "../../../package.json";

const socialLinks = [
  { label: "TikTok", short: "TT", href: "https://www.tiktok.com/" },
  { label: "Threads", short: "TH", href: "https://www.threads.net/" },
  { label: "Instagram", short: "IG", href: "https://www.instagram.com/" },
  { label: "YouTube", short: "YT", href: "https://www.youtube.com/" }
];

export default function Footer() {
  const { language, setLanguage, t } = useI18n();

  return (
    <footer className="site-footer">
      <div className="footer-version">
        <p>&copy; 2026 Eclipcity</p>
        <span>Patch v{packageMetadata.version}</span>
      </div>
      <div className="language-switch" aria-label={t("actions.language")}>
        <button
          type="button"
          className={language === "uk" ? "active" : ""}
          aria-pressed={language === "uk"}
          onClick={() => setLanguage("uk")}
        >
          UKR
        </button>
        <button
          type="button"
          className={language === "en" ? "active" : ""}
          aria-pressed={language === "en"}
          onClick={() => setLanguage("en")}
        >
          ENG
        </button>
      </div>
      <div className="social-links" aria-label="Соціальні мережі">
        {socialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            rel="noreferrer"
            target="_blank"
          >
            {link.short}
          </a>
        ))}
      </div>
    </footer>
  );
}
