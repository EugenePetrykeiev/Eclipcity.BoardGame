import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import GamePage from "./pages/GamePage.jsx";
import UserPage from "./pages/UserPage.jsx";
import { getAuthSession } from "./services/authClient.js";
import { audioManager } from "./services/audioManager.js";
import { useI18n } from "./i18n/I18nProvider.jsx";

export default function App() {
  const { t } = useI18n();
  const [homeAuthCheck, setHomeAuthCheck] = useState(
    window.location.pathname === "/" ? "checking" : "done"
  );

  useEffect(() => {
    if (window.location.pathname !== "/") {
      return undefined;
    }

    let isMounted = true;
    getAuthSession()
      .then((session) => {
        if (isMounted && session.authenticated && session.next) {
          window.location.replace(session.next);
          return;
        }
        if (isMounted) {
          setHomeAuthCheck("done");
        }
      })
      .catch(() => {
        if (isMounted) {
          setHomeAuthCheck("done");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const isGameScene = window.location.pathname.startsWith("/game/");
    if (!isGameScene && homeAuthCheck === "checking") {
      return;
    }

    audioManager.setScene(isGameScene ? "battle" : "menu");
  }, [homeAuthCheck]);

  useEffect(() => {
    const clickableSelector = [
      "button:not(:disabled)",
      "a[href]",
      "select:not(:disabled)",
      'input[type="checkbox"]:not(:disabled)',
      'input[type="range"]:not(:disabled)',
      '[role="button"]'
    ].join(",");
    const hoverableSelector = `${clickableSelector},[data-ui-sound]`;

    function getUiTarget(event, selector = clickableSelector) {
      const target = event.target instanceof Element
        ? event.target.closest(selector)
        : null;
      if (!target || target.closest("[data-audio-scope]")) {
        return null;
      }
      return target;
    }

    function handleUiClick(event) {
      if (getUiTarget(event)) {
        audioManager.playEffect("hitButton");
      }
    }

    function handleUiHover(event) {
      const target = getUiTarget(event, hoverableSelector);
      if (
        target &&
        (!event.relatedTarget || !target.contains(event.relatedTarget))
      ) {
        audioManager.playEffect("hoverButton");
      }
    }

    document.addEventListener("click", handleUiClick);
    document.addEventListener("pointerover", handleUiHover);
    return () => {
      document.removeEventListener("click", handleUiClick);
      document.removeEventListener("pointerover", handleUiHover);
    };
  }, []);

  if (
    window.location.pathname.startsWith("/user/") ||
    window.location.pathname.startsWith("/lobby/")
  ) {
    return <UserPage />;
  }

  if (window.location.pathname.startsWith("/game/")) {
    return <GamePage />;
  }

  if (homeAuthCheck === "checking") {
    return <div className="home-page" aria-label={t("app.checkingSession")} />;
  }

  return <HomePage />;
}
