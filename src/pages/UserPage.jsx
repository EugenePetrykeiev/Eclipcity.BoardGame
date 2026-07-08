import { useEffect, useMemo, useRef, useState } from "react";
import { Settings, Volume2, VolumeX } from "lucide-react";
import { getUserProfile } from "../services/authClient.js";
import defaultUserAvatar from "../assets/default-user-avatar.svg";

const userPathPattern =
  /^\/user\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

const actions = [
  {
    id: "create-lobby",
    label: "Створити лоббі",
    message: "Викликано дію: створити лоббі. Функціонал буде підключено пізніше."
  },
  {
    id: "join-lobby",
    label: "Приєднатися до лоббі",
    message:
      "Викликано дію: приєднатися до лоббі. Пізніше тут буде форма для коду кімнати."
  },
  {
    id: "local-game",
    label: "Грати локально",
    message:
      "Викликано дію: грати локально. Локальний режим буде доступний після ігрового столу."
  },
  {
    id: "settings",
    label: "Налаштування",
    message:
      "Викликано дію: налаштування. Тут будуть профіль, звук, мова та системні параметри.",
    icon: Settings
  }
];

function userIdFromPath() {
  const match = window.location.pathname.match(userPathPattern);
  return match?.[1] || null;
}

function ToastStack({ notifications, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {notifications.map((notification) => (
        <div className="action-toast" key={notification.id}>
          <button
            type="button"
            className="toast-close"
            aria-label="Закрити повідомлення"
            onClick={() => onDismiss(notification.id)}
          >
            ×
          </button>
          <p>{notification.message}</p>
        </div>
      ))}
    </div>
  );
}

export default function UserPage() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const timersRef = useRef(new Map());

  const routeUserId = useMemo(() => userIdFromPath(), []);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!routeUserId) {
        setStatus("error");
        setError("Некоректний user route. Очікується /user/UUID.");
        return;
      }

      try {
        const profile = await getUserProfile(routeUserId);
        if (!isMounted) {
          return;
        }
        setUser(profile);
        setStatus("ready");
      } catch (requestError) {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setError(requestError.message || "Не вдалося завантажити профіль.");
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [routeUserId]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current.clear();
    };
  }, []);

  function dismissNotification(id) {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id)
    );
  }

  function notify(message) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotifications((current) => [...current, { id, message }]);
    const timerId = window.setTimeout(() => {
      dismissNotification(id);
    }, 5000);
    timersRef.current.set(id, timerId);
  }

  function toggleSound() {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    notify(nextValue ? "Звуки увімкнено." : "Звуки вимкнено.");
  }

  return (
    <div className="user-page">
      <ToastStack notifications={notifications} onDismiss={dismissNotification} />

      <main className="user-shell" aria-label="Профіль користувача Eclipcity">
        <section className="profile-sidebar" aria-label="Дані користувача">
          {status === "loading" && (
            <p className="profile-state">Завантаження профілю...</p>
          )}

          {status === "error" && (
            <div className="profile-state">
              <p>{error}</p>
              <a href="/">Повернутися на головну</a>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="profile-identity">
                <div className="profile-avatar" aria-hidden="true">
                  <img src={defaultUserAvatar} alt="" />
                </div>
                <div>
                  <p className="profile-kicker">Runner profile</p>
                  <h1>{user.username || "Невідомий користувач"}</h1>
                  <p className="profile-username">@{user.username}</p>
                </div>
              </div>

              <div className="profile-stats" aria-label="Статистика гравця">
                <div>
                  <strong>0</strong>
                  <span>матчів зіграно</span>
                </div>
                <div>
                  <strong>0</strong>
                  <span>перемог</span>
                </div>
              </div>

              <div className="profile-actions" aria-label="Дії користувача">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => notify(action.message)}
                    >
                      {Icon && <Icon aria-hidden="true" size={18} strokeWidth={2} />}
                      <span>{action.label}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={soundEnabled ? "" : "muted"}
                  aria-pressed={!soundEnabled}
                  onClick={toggleSound}
                >
                  {soundEnabled ? (
                    <Volume2 aria-hidden="true" size={18} strokeWidth={2} />
                  ) : (
                    <VolumeX aria-hidden="true" size={18} strokeWidth={2} />
                  )}
                  <span>{soundEnabled ? "Вимкнути звуки" : "Увімкнути звуки"}</span>
                </button>
              </div>
            </>
          )}
        </section>

        <section className="user-stage" aria-label="Майбутня ігрова зона">
          <p className="profile-kicker">Eclipcity access</p>
          <h2>Лоббі та ігровий стіл з'являться тут</h2>
          <p>
            Це персональна зона користувача після авторизації. Ліворуч
            залишаються профіль, статистика та основні дії, а центральна зона
            зарезервована під кімнати, локальну гру та майбутній стіл.
          </p>
        </section>
      </main>
    </div>
  );
}
