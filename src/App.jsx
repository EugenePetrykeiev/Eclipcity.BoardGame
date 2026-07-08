import HomePage from "./pages/HomePage.jsx";
import UserPage from "./pages/UserPage.jsx";

export default function App() {
  if (window.location.pathname.startsWith("/user/")) {
    return <UserPage />;
  }

  return <HomePage />;
}
