export default function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Eclipcity home">
        Eclipcity
      </a>
      <nav className="main-nav" aria-label="Основна навігація">
        <a href="#about-game">Про гру</a>
        <a href="#how-to-play">Як грати</a>
      </nav>
      <div className="header-slot" aria-hidden="true">
        <span>2150</span>
      </div>
    </header>
  );
}
