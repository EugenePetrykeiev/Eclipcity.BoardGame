import AuthPanel from "../components/auth/AuthPanel.jsx";
import Footer from "../components/layout/Footer.jsx";
import Header from "../components/layout/Header.jsx";
import GameVisual from "../components/home/GameVisual.jsx";

export default function HomePage() {
  return (
    <div className="home-page">
      <Header />
      <main className="home-main">
        <section className="hero" aria-label="Головна сторінка Eclipcity">
          <GameVisual />
          <AuthPanel />
        </section>

        <section className="home-info" aria-label="Про гру та правила">
          <article className="info-panel" id="about-game">
            <p className="info-kicker">Про гру</p>
            <h2>Втеча крізь місто, яке не відпускає</h2>
            <p>
              Eclipcity - браузерна мультиплеєрна карткова гра для максимум
              п'яти гравців. Кожна команда веде сімох втікачів тунелем із
              символів, де кожна карта змінює темп гонитви.
            </p>
          </article>
          <article className="info-panel" id="how-to-play">
            <p className="info-kicker">Як грати</p>
            <h2>Рухайся вперед або відступай за ресурсами</h2>
            <p>
              Розігруй карти предметів, щоб рухати в'язнів до найближчої
              вільної клітинки. Коли карт бракує, повертайся назад на зайняті
              позиції та добирай нові ресурси для фінального ривка.
            </p>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
}
