import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import UserPage from "./pages/UserPage.jsx";
import { getAuthSession } from "./services/authClient.js";

export default function App() {
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

  if (
    window.location.pathname.startsWith("/user/") ||
    window.location.pathname.startsWith("/lobby/")
  ) {
    return <UserPage />;
  }

  if (homeAuthCheck === "checking") {
    return <div className="home-page" aria-label="Перевірка сесії" />;
  }

  return <HomePage />;
}
