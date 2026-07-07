const socialLinks = [
  { label: "TikTok", short: "TT", href: "https://www.tiktok.com/" },
  { label: "Threads", short: "TH", href: "https://www.threads.net/" },
  { label: "Instagram", short: "IG", href: "https://www.instagram.com/" },
  { label: "YouTube", short: "YT", href: "https://www.youtube.com/" }
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>&copy; 2026 Eclipcity</p>
      <div className="language-switch" aria-label="Мови">
        <a href="/ukr/" aria-current="page">
          UKR
        </a>
        <a href="/">ENG</a>
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
