import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CircleDot,
  Flag,
  LogOut,
  Maximize2,
  MoveRight,
  RotateCcw,
  Settings,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  createLobby as createLobbyRequest,
  getActiveGame,
  getCurrentUser,
  getLobbyDetails,
  getUserGameHistory,
  getUserProfile,
  joinLobbyByCode,
  kickLobbyPlayer,
  leaveLobbyByCode,
  listPublicLobbies,
  logoutCurrentUser,
  startLobbyGame,
  updateLobbyPlayer
} from "../services/authClient.js";
import {
  audioManager,
  MAX_EFFECTS_VOLUME,
  MAX_MUSIC_VOLUME
} from "../services/audioManager.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import {
  MAX_VOLUME_PERCENT,
  MIN_VOLUME_PERCENT,
  percentToVolume,
  volumeToPercent
} from "../utils/audioVolume.js";
import { defaultLobbyName, validateLobbyName } from "../utils/lobbyName.js";
import defaultUserAvatar from "../assets/default-user-avatar.svg";
import packageMetadata from "../../package.json";

const userPathPattern =
  /^\/user\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;
const lobbyPathPattern = /^\/lobby\/([a-z0-9]{5})\/?$/i;

const actions = [
  {
    id: "start-game"
  },
  {
    id: "how-to-play",
    icon: BookOpen
  },
  {
    id: "settings",
    icon: Settings
  }
];

const teamOptions = [
  { id: "green", label: "Green", color: "#B6FF00" },
  { id: "purple", label: "Purple", color: "#7B2FFF" },
  { id: "orange", label: "Orange", color: "#FF5A1F" },
  { id: "pink", label: "Pink", color: "#FF2E9A" },
  { id: "turquoise", label: "Turquoise", color: "#00F5D4" }
];

function userIdFromPath() {
  const match = window.location.pathname.match(userPathPattern);
  return match?.[1] || null;
}

function lobbyCodeFromPath() {
  const match = window.location.pathname.match(lobbyPathPattern);
  return match?.[1]?.toUpperCase() || null;
}

function routeContextFromPath() {
  const userId = userIdFromPath();
  if (userId) {
    return { type: "user", userId, lobbyCode: null };
  }

  const lobbyCode = lobbyCodeFromPath();
  if (lobbyCode) {
    return { type: "lobby", userId: null, lobbyCode };
  }

  return { type: "invalid", userId: null, lobbyCode: null };
}

function ToastStack({ notifications, onDismiss, t }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {notifications.map((notification) => (
        <div className="action-toast" key={notification.id}>
          <button
            type="button"
            className="toast-close"
            aria-label={t("common.close")}
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

function LobbyDots({ current, max, t }) {
  return (
    <div
      className="lobby-dots"
      aria-label={t("common.playersCount", { current, max })}
    >
      {Array.from({ length: max }).map((_, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={`lobby-dot ${index < current ? "filled" : ""}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ScrollPanel({ children, className = "", ...props }) {
  return (
    <div className={`scroll-panel ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

function HowToPlayModal({ onClose, t }) {
  const facts = [
    { value: "45", label: t("rules.factTiles") },
    { value: "6", label: t("rules.factCards") },
    { value: "7", label: t("rules.factPrisoners") },
    { value: "0–3", label: t("rules.factActions") }
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="confirm-modal how-to-modal scroll-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-title"
      >
        <button
          type="button"
          className="modal-close"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} strokeWidth={2} />
        </button>

        <header className="rules-hero">
          <span className="rules-hero-icon" aria-hidden="true">
            <BookOpen size={30} strokeWidth={1.8} />
          </span>
          <div>
            <p className="profile-kicker">{t("rules.kicker")}</p>
            <h2 id="how-to-title">{t("rules.title")}</h2>
            <p>{t("rules.intro")}</p>
          </div>
        </header>

        <div className="rules-facts" aria-label={t("rules.quickFacts")}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>

        <section className="rules-turn-flow" aria-labelledby="rules-turn-title">
          <div className="rules-section-heading">
            <CircleDot aria-hidden="true" size={21} />
            <h3 id="rules-turn-title">{t("rules.turnTitle")}</h3>
          </div>
          <p>{t("rules.turnText")}</p>
          <div className="rules-action-path" aria-label={t("rules.turnPath")}>
            <span>{t("rules.selectPrisoner")}</span>
            <MoveRight aria-hidden="true" size={18} />
            <span>{t("rules.chooseAction")}</span>
            <MoveRight aria-hidden="true" size={18} />
            <span>{t("rules.completeAction")}</span>
          </div>
        </section>

        <div className="rules-card-grid">
          <article className="rule-card forward">
            <span className="rule-card-icon" aria-hidden="true">
              <MoveRight size={26} />
            </span>
            <div>
              <p className="rule-number">01</p>
              <h3>{t("rules.forwardTitle")}</h3>
              <p>{t("rules.forwardText")}</p>
              <strong>{t("rules.forwardExit")}</strong>
            </div>
          </article>

          <article className="rule-card backward">
            <span className="rule-card-icon" aria-hidden="true">
              <RotateCcw size={26} />
            </span>
            <div>
              <p className="rule-number">02</p>
              <h3>{t("rules.backwardTitle")}</h3>
              <p>{t("rules.backwardText")}</p>
            </div>
            <div className="draw-rules">
              <span><i>1</i>{t("rules.drawOne")}</span>
              <span><i>2</i>{t("rules.drawTwo")}</span>
              <span className="blocked"><i>3</i>{t("rules.tileFull")}</span>
            </div>
          </article>

          <article className="rule-card start">
            <span className="rule-card-icon" aria-hidden="true">
              <Users size={26} />
            </span>
            <div>
              <p className="rule-number">03</p>
              <h3>{t("rules.startTitle")}</h3>
              <p>{t("rules.startText")}</p>
            </div>
          </article>

          <article className="rule-card victory">
            <span className="rule-card-icon" aria-hidden="true">
              <Trophy size={26} />
            </span>
            <div>
              <p className="rule-number">04</p>
              <h3>{t("rules.victoryTitle")}</h3>
              <p>{t("rules.victoryText")}</p>
            </div>
            <div className="victory-route" aria-hidden="true">
              <Users size={19} />
              <span />
              <Flag size={21} />
            </div>
          </article>
        </div>

        <aside className="rules-tip">
          <strong>{t("rules.tipTitle")}</strong>
          <p>{t("rules.tipText")}</p>
        </aside>
      </section>
    </div>
  );
}

export default function UserPage() {
  const { language, setLanguage, t } = useI18n();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [audioPreferences, setAudioPreferences] = useState(() =>
    audioManager.getPreferences()
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [lobbyForm, setLobbyForm] = useState({
    name: "",
    playerLimit: 5,
    isPublic: true
  });
  const [gameTileCount, setGameTileCount] = useState(45);
  const [lobby, setLobby] = useState(null);
  const [gameScenario, setGameScenario] = useState(null);
  const [publicLobbies, setPublicLobbies] = useState([]);
  const [publicLobbyStatus, setPublicLobbyStatus] = useState("idle");
  const [selectedLobbyCode, setSelectedLobbyCode] = useState("");
  const [lobbyCodeInput, setLobbyCodeInput] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const timersRef = useRef(new Map());

  const routeContext = useMemo(() => routeContextFromPath(), []);
  const startGameLabel = useMemo(() => {
    if (gameScenario === "create-lobby") {
      return t("start.created");
    }
    if (gameScenario === "join-lobby") {
      return t("start.joined");
    }
    if (gameScenario === "local-game") {
      return t("start.local");
    }
    if (activePanel === "game-menu") {
      return t("start.choose");
    }
    if (activePanel === "create-lobby") {
      return t("start.creating");
    }
    if (activePanel === "join-lobby") {
      return t("start.joining");
    }
    return t("actions.startGame");
  }, [activePanel, gameScenario, t]);
  const normalizedLobbyName = lobbyForm.name.trim();
  const lobbyNameValidation = useMemo(() => {
    return validateLobbyName(normalizedLobbyName, {
      min: t("lobby.nameMin"),
      max: t("lobby.nameMax"),
      chars: t("lobby.nameChars")
    });
  }, [normalizedLobbyName, t]);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (routeContext.type === "invalid") {
        setStatus("error");
        setError(t("route.invalid"));
        return;
      }

      try {
        const profile =
          routeContext.type === "user"
            ? await getUserProfile(routeContext.userId)
            : await getCurrentUser();
        if (!isMounted) {
          return;
        }
        setUser(profile);

        if (routeContext.type === "lobby") {
          const activeLobby = await joinLobbyByCode(routeContext.lobbyCode);
          if (!isMounted) {
            return;
          }
          setLobby(activeLobby);
          setActivePanel("lobby");
          setGameScenario("join-lobby");
        } else {
          setActivePanel("profile");
          try {
            const history = await getUserGameHistory(profile.id);
            if (isMounted) {
              setGameHistory(history);
            }
          } catch {
            if (isMounted) {
              setGameHistory([]);
            }
          }
          try {
            const activeGamePayload = await getActiveGame();
            if (isMounted) {
              setActiveGame(activeGamePayload.game || null);
            }
          } catch {
            if (isMounted) {
              setActiveGame(null);
            }
          }
        }

        setStatus("ready");
      } catch (requestError) {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setError(requestError.message || t("route.profileError"));
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [routeContext, t]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => audioManager.subscribe(setAudioPreferences), []);

  useEffect(() => {
    if (status !== "ready" || !lobby?.code) {
      return undefined;
    }

    let isPolling = true;
    const refreshLobby = async () => {
      try {
        const nextLobby = await getLobbyDetails(lobby.code);
        if (!isPolling) {
          return;
        }
        if (!nextLobby.is_member || nextLobby.status !== "waiting") {
          setLobby(null);
          setGameScenario(null);
          setActivePanel("profile");
          navigateTo(userHomePath());
          notify(t("lobby.noLongerMember"));
          return;
        }
        setLobby((current) => {
          if (!current || current.code !== nextLobby.code) {
            return current;
          }
          return { ...nextLobby, minimized: current.minimized };
        });
      } catch {
        try {
          const activeGamePayload = await getActiveGame();
          if (isPolling && activeGamePayload.game?.path) {
            window.location.assign(activeGamePayload.game.path);
          }
        } catch {
          // Keep the visible lobby stable on transient polling failures.
        }
      }
    };

    const intervalId = window.setInterval(refreshLobby, 2500);
    return () => {
      isPolling = false;
      window.clearInterval(intervalId);
    };
  }, [lobby?.code, status, t]);

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
    setNotifications((current) => [...current, { id, message: String(message) }]);
    const timerId = window.setTimeout(() => {
      dismissNotification(id);
    }, 5000);
    timersRef.current.set(id, timerId);
  }

  function toggleSound() {
    const nextValue = !audioPreferences.enabled;
    audioManager.setEnabled(nextValue);
    notify(nextValue ? t("actions.soundOnToast") : t("actions.soundOffToast"));
  }

  function changeMusicVolume(event) {
    audioManager.setMusicVolume(
      percentToVolume(event.target.value, MAX_MUSIC_VOLUME)
    );
  }

  function changeEffectsVolume(event) {
    audioManager.setEffectsVolume(
      percentToVolume(event.target.value, MAX_EFFECTS_VOLUME)
    );
  }

  async function logout() {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await logoutCurrentUser();
      window.location.assign("/");
    } catch (requestError) {
      setIsLoggingOut(false);
      notify(requestError.message || t("settings.logoutError"));
    }
  }

  function userHomePath() {
    return user?.id ? `/user/${user.id}` : "/";
  }

  function navigateTo(path) {
    window.history.pushState({}, "", path);
  }

  async function refreshPublicLobbies() {
    setPublicLobbyStatus("loading");
    try {
      const lobbies = await listPublicLobbies();
      setPublicLobbies(lobbies);
      setPublicLobbyStatus("ready");
    } catch (requestError) {
      setPublicLobbyStatus("error");
      notify(requestError.message || t("join.refreshError"));
    }
  }

  async function copyLobbyCode() {
    if (!lobby?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lobby.code);
      notify(t("lobby.copyToast", { code: lobby.code }));
    } catch {
      notify(t("common.clipboardError"));
    }
  }

  function handleAction(action) {
    if (action.id === "start-game") {
      if (lobby) {
        setLobby((current) => (current ? { ...current, minimized: false } : current));
        setActivePanel("lobby");
        return;
      }

      if (gameScenario) {
        return;
      }

      setActivePanel("game-menu");
      return;
    }

    if (action.id === "settings") {
      setIsSettingsOpen(true);
      return;
    }

    if (action.id === "how-to-play") {
      setIsHowToPlayOpen(true);
      return;
    }

    notify(t("actions.settingsToast"));
  }

  function selectCreateLobby() {
    setActivePanel("create-lobby");
  }

  function selectJoinLobby() {
    setActivePanel("join-lobby");
    refreshPublicLobbies();
  }

  async function createLobby() {
    if (!user || !lobbyNameValidation.isValid) {
      return;
    }

    const finalName = normalizedLobbyName || defaultLobbyName;

    try {
      const nextLobby = await createLobbyRequest({
        name: finalName,
        max_players: Number(lobbyForm.playerLimit),
        is_public: lobbyForm.isPublic
      });
      setLobby({ ...nextLobby, minimized: false });
      setGameScenario("create-lobby");
      setActivePanel("lobby");
      navigateTo(nextLobby.path);
      notify(t("lobby.createdToast", { name: nextLobby.name, code: nextLobby.code }));
    } catch (requestError) {
      notify(requestError.message || t("lobby.createError"));
    }
  }

  async function updatePlayerTeam(playerId, teamId) {
    if (!lobby || playerId !== user?.id) {
      return;
    }

    try {
      const nextLobby = await updateLobbyPlayer(lobby.code, { team_color: teamId });
      setLobby({ ...nextLobby, minimized: lobby.minimized });
    } catch (requestError) {
      notify(requestError.message || t("lobby.teamError"));
    }
  }

  async function leaveLobby({ silent = false } = {}) {
    if (!lobby || !user) {
      return;
    }

    try {
      const result = await leaveLobbyByCode(lobby.code);
      setLobby(null);
      setGameScenario(null);
      setActivePanel("profile");
      navigateTo(result.next || userHomePath());
      if (!silent) {
        notify(t("lobby.leftToast"));
      }
    } catch (requestError) {
      notify(requestError.message || t("lobby.leaveError"));
    }
  }

  async function confirmLeaveLobby() {
    const nextActionId = confirmModal?.actionId;
    await leaveLobby({ silent: true });
    setConfirmModal(null);
    if (nextActionId === "join-lobby") {
      setActivePanel("join-lobby");
      refreshPublicLobbies();
      notify(t("modal.currentClosedJoin"));
      return;
    }

    notify(t("modal.currentClosedLocal"));
  }

  function restoreLobby() {
    setLobby((current) => (current ? { ...current, minimized: false } : current));
    setActivePanel("lobby");
  }

  function openProfilePanel() {
    if (lobby && !lobby.minimized) {
      setLobby((current) => (current ? { ...current, minimized: true } : current));
    }
    setActivePanel("profile");
    navigateTo(userHomePath());
  }

  async function joinSelectedLobby() {
    if (!selectedLobbyCode) {
      return;
    }
    await joinLobby(selectedLobbyCode);
  }

  async function joinLobby(code) {
    try {
      const nextLobby = await joinLobbyByCode(code);
      setLobby({ ...nextLobby, minimized: false });
      setGameScenario("join-lobby");
      setActivePanel("lobby");
      navigateTo(nextLobby.path);
      notify(t("join.success", { code: nextLobby.code }));
    } catch (requestError) {
      notify(requestError.message || t("join.errorToast"));
    }
  }

  async function joinLobbyFromCode() {
    if (lobbyCodeInput.trim().length !== 5) {
      notify(t("join.codeLength"));
      return;
    }
    await joinLobby(lobbyCodeInput.trim().toUpperCase());
  }

  async function kickPlayer(playerId) {
    if (!lobby) {
      return;
    }

    try {
      const nextLobby = await kickLobbyPlayer(lobby.code, playerId);
      setLobby({ ...nextLobby, minimized: lobby.minimized });
      notify(t("lobby.kickedToast"));
    } catch (requestError) {
      notify(requestError.message || t("lobby.kickError"));
    }
  }

  async function startCurrentLobbyGame() {
    if (!lobby) {
      return;
    }

    try {
      const nextGame = await startLobbyGame(lobby.code, {
        route_tile_count: Number(gameTileCount)
      });
      window.location.assign(nextGame.path);
    } catch (requestError) {
      notify(requestError.message || t("gamePage.startError"));
    }
  }

  const renderStageContent = () => {
    if (status !== "ready") {
      return (
        <>
          <p className="profile-kicker">{t("stage.access")}</p>
          <h2>{t("stage.title")}</h2>
          <p>{t("stage.text")}</p>
        </>
      );
    }

    if (activePanel === "profile") {
      return (
        <div className="game-history-panel">
          <p className="profile-kicker">{t("history.kicker")}</p>
          <h2>{t("history.title")}</h2>
          <div className="game-history-scroll">
            <table className="game-history-table">
              <thead>
                <tr>
                  <th>{t("history.date")}</th>
                  <th>{t("history.duration")}</th>
                  <th>{t("history.place")}</th>
                  <th>{t("history.color")}</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.map((item) => (
                  <tr key={item.game_id}>
                    <td>
                      {new Intl.DateTimeFormat(
                        language === "uk"
                          ? "uk-UA"
                          : language === "de"
                            ? "de-DE"
                            : "en-GB",
                        { dateStyle: "medium", timeStyle: "short" }
                      ).format(new Date(item.started_at))}
                    </td>
                    <td>
                      {`${Math.floor(item.duration_seconds / 60)}:${String(
                        item.duration_seconds % 60
                      ).padStart(2, "0")}`}
                    </td>
                    <td>#{item.finish_order}</td>
                    <td>
                      <span className={`history-color ${item.team_color}`}>
                        {t(`colors.${item.team_color}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gameHistory.length === 0 && (
              <p className="game-history-empty">{t("history.empty")}</p>
            )}
          </div>
        </div>
      );
    }

    if (activePanel === "create-lobby") {
      return (
        <div className="lobby-panel create-lobby-panel">
          <button
            type="button"
            className="join-back-button"
            aria-label={t("common.backHome")}
            onClick={() => setActivePanel("game-menu")}
          >
            <ArrowLeft aria-hidden="true" size={20} strokeWidth={2} />
            <span>{t("common.backHome")}</span>
          </button>

          <div className="lobby-panel-header">
            <p className="profile-kicker">{t("lobby.setup")}</p>
            <h2>{t("lobby.createTitle")}</h2>
          </div>

          <div className="lobby-form" aria-label={t("lobby.createTitle")}>
            <label className="lobby-field">
              <span>{t("lobby.playersAmount")}</span>
              <select
                value={lobbyForm.playerLimit}
                onChange={(event) =>
                  setLobbyForm((current) => ({
                    ...current,
                    playerLimit: Number(event.target.value)
                  }))
                }
              >
                {[2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="lobby-field">
              <span>{t("lobby.name")}</span>
              <input
                type="text"
                value={lobbyForm.name}
                maxLength={15}
                placeholder={defaultLobbyName}
                aria-invalid={!lobbyNameValidation.isValid}
                onChange={(event) =>
                  setLobbyForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="lobby-checkbox">
              <input
                type="checkbox"
                checked={lobbyForm.isPublic}
                onChange={(event) =>
                  setLobbyForm((current) => ({
                    ...current,
                    isPublic: event.target.checked
                  }))
                }
              />
              <span>{lobbyForm.isPublic ? t("lobby.public") : t("lobby.private")}</span>
            </label>

            <p className={`lobby-hint ${lobbyNameValidation.isValid ? "" : "error"}`}>
              {lobbyNameValidation.message || t("lobby.defaultNameHint")}
            </p>

            <button
              type="button"
              className="lobby-create-button"
              disabled={!lobbyNameValidation.isValid}
              onClick={createLobby}
            >
              {t("lobby.create")}
            </button>
          </div>
        </div>
      );
    }

    if (activePanel === "join-lobby") {
      return (
        <div className="lobby-panel join-lobby-panel">
          <button
            type="button"
            className="join-back-button"
            aria-label={t("common.backHome")}
            onClick={() => setActivePanel("game-menu")}
          >
            <ArrowLeft aria-hidden="true" size={20} strokeWidth={2} />
            <span>{t("common.backHome")}</span>
          </button>

          <div className="lobby-panel-header split">
            <div>
              <p className="profile-kicker">{t("join.kicker")}</p>
              <h2>{t("join.title")}</h2>
            </div>

            <div className="code-join-box" aria-label={t("join.byCodeLabel")}>
              <label>
                <span>{t("join.code")}</span>
                <input
                  type="text"
                  value={lobbyCodeInput}
                  maxLength={5}
                  placeholder="A1B2C"
                  onChange={(event) =>
                    setLobbyCodeInput(event.target.value.toUpperCase())
                  }
                />
              </label>
              <button
                type="button"
                disabled={lobbyCodeInput.trim().length !== 5}
                onClick={joinLobbyFromCode}
              >
                {t("join.byCode")}
              </button>
            </div>
          </div>

          <div className="public-lobby-list" aria-label={t("join.listLabel")}>
            <div className="public-lobby-head" aria-hidden="true">
              <span>{t("join.nameHeader")}</span>
              <span>{t("join.idHeader")}</span>
              <span>{t("join.playersHeader")}</span>
            </div>

            <ScrollPanel className="public-lobby-scroll">
              {publicLobbyStatus === "loading" && (
                <p className="lobby-list-state">{t("join.loading")}</p>
              )}

              {publicLobbyStatus === "error" && (
                <p className="lobby-list-state">{t("join.error")}</p>
              )}

              {publicLobbyStatus === "ready" && publicLobbies.length === 0 && (
                <p className="lobby-list-state">{t("join.empty")}</p>
              )}

              {publicLobbies.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  className={`public-lobby-row ${
                    selectedLobbyCode === item.code ? "selected" : ""
                  }`}
                  aria-pressed={selectedLobbyCode === item.code}
                  onClick={() => setSelectedLobbyCode(item.code)}
                >
                  <span>{item.name}</span>
                  <strong>{item.code}</strong>
                  <span>
                    {item.player_count}/{item.max_players}
                  </span>
                </button>
              ))}
            </ScrollPanel>
          </div>

          <div className="lobby-buttons">
            <button type="button" disabled={!selectedLobbyCode} onClick={joinSelectedLobby}>
              {t("join.submit")}
            </button>
            <button type="button" className="secondary" onClick={refreshPublicLobbies}>
              {t("join.refresh")}
            </button>
          </div>
        </div>
      );
    }

    if (activePanel === "lobby" && lobby) {
      return (
        <div className="lobby-panel active-lobby">
          <div className="lobby-panel-header">
            <p className="profile-kicker">
              {lobby.is_public ? t("lobby.publicKicker") : t("lobby.privateKicker")}
            </p>
            <h2>{lobby.name}</h2>
            <button
              type="button"
              className="lobby-code-badge"
              onClick={copyLobbyCode}
              title={t("lobby.copyTitle")}
            >
              ID: {lobby.code}
            </button>
            <LobbyDots current={lobby.players.length} max={lobby.max_players} t={t} />
          </div>

          <ScrollPanel className="lobby-table-wrap">
            <table className="lobby-table">
              <thead>
                <tr>
                  <th>{t("lobby.nickname")}</th>
                  <th>{t("lobby.team")}</th>
                  <th>{t("lobby.host")}</th>
                  <th aria-label={t("lobby.controls")} />
                </tr>
              </thead>
              <tbody>
                {lobby.players.map((player) => {
                  const selectedTeam = teamOptions.find(
                    (team) => team.id === player.team_color
                  );
                  const canKickPlayer = lobby.is_host && player.user_id !== user?.id;
                  const usedByOtherPlayer = new Set(
                    lobby.players
                      .filter((item) => item.user_id !== player.user_id)
                      .map((item) => item.team_color)
                  );
                  return (
                    <tr key={player.user_id}>
                      <td>{player.nickname}</td>
                      <td>
                        <label className="team-select-label">
                          <span
                            className="team-swatch"
                            style={{ "--team-color": selectedTeam?.color }}
                            aria-hidden="true"
                          />
                          <select
                            className="team-select"
                            value={player.team_color}
                            disabled={player.user_id !== user?.id}
                            onChange={(event) =>
                              updatePlayerTeam(player.user_id, event.target.value)
                            }
                          >
                            {teamOptions.map((team) => (
                              <option
                                key={team.id}
                                value={team.id}
                                disabled={usedByOtherPlayer.has(team.id)}
                              >
                                {team.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="host-check"
                          checked={player.is_host}
                          disabled
                          readOnly
                          aria-label={player.is_host ? t("lobby.hostAria") : t("lobby.notHostAria")}
                        />
                      </td>
                      <td className="kick-cell">
                        {canKickPlayer && (
                          <button
                            type="button"
                            className="kick-player-button"
                            aria-label={t("lobby.kick", { nickname: player.nickname })}
                            onClick={() => kickPlayer(player.user_id)}
                          >
                            <X aria-hidden="true" size={16} strokeWidth={2} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollPanel>

          <div className="lobby-log-shell" aria-label={t("lobby.events")}>
            <ScrollPanel className="lobby-log">
              {lobby.events.map((event) => (
                <p key={event.id}>{event.message}</p>
              ))}
            </ScrollPanel>
            <input type="text" disabled placeholder={t("lobby.chatPlaceholder")} />
          </div>

          {lobby.is_host && user?.username?.toLowerCase() === "eugenepetrikeev" && (
            <div className="game-route-options" aria-label={t("lobby.routeTileCount")}>
              <label className="lobby-field">
                <span>{t("lobby.routeTileCount")}</span>
                <input
                  type="number"
                  min={5}
                  max={45}
                  value={gameTileCount}
                  onChange={(event) =>
                    setGameTileCount(
                      Math.min(45, Math.max(5, Number(event.target.value) || 5))
                    )
                  }
                />
              </label>
              <div className="route-preset-buttons" aria-label={t("lobby.routePreset")}>
                <button
                  type="button"
                  className={gameTileCount === 45 ? "active" : ""}
                  onClick={() => setGameTileCount(45)}
                >
                  {t("lobby.routeStandard")}
                </button>
                <button
                  type="button"
                  className={gameTileCount === 5 ? "active" : ""}
                  onClick={() => setGameTileCount(5)}
                >
                  {t("lobby.routeTest")}
                </button>
              </div>
            </div>
          )}

          <div className="lobby-buttons">
            {lobby.is_host && (
              <button
                type="button"
                onClick={startCurrentLobbyGame}
              >
                {t("lobby.start")}
              </button>
            )}
            <button type="button" className="secondary" onClick={() => leaveLobby()}>
              {t("lobby.leave")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <p className="profile-kicker">{t("stage.access")}</p>
        <h2>{t("stage.title")}</h2>
        <p>{t("stage.text")}</p>
      </>
    );
  };

  return (
    <div className="user-page">
      <ToastStack notifications={notifications} onDismiss={dismissNotification} t={t} />
      {lobby?.minimized && (
        <aside className="minimized-lobby" aria-label={t("lobby.minimizedLabel")}>
          <button
            type="button"
            className="minimized-close"
            aria-label={t("lobby.restore")}
            onClick={restoreLobby}
          >
            <Maximize2 aria-hidden="true" size={16} strokeWidth={2} />
          </button>
          <p className="profile-kicker">{t("lobby.active")}</p>
          <strong>{lobby.name}</strong>
          <span>
            {t("common.playersCount", {
              current: lobby.players.length,
              max: lobby.max_players
            })}
          </span>
          <LobbyDots current={lobby.players.length} max={lobby.max_players} t={t} />
        </aside>
      )}

      {confirmModal && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lobby-confirm-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label={t("common.close")}
              onClick={() => setConfirmModal(null)}
            >
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
            <p className="profile-kicker">{t("modal.conflict")}</p>
            <h2 id="lobby-confirm-title">{confirmModal.title}</h2>
            <p>{confirmModal.message}</p>
            <div className="modal-actions">
              <button type="button" onClick={confirmLeaveLobby}>
                {t("modal.leave")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmModal(null)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeGame && activePanel === "profile" && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-game-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label={t("common.close")}
              onClick={() => setActiveGame(null)}
            >
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
            <p className="profile-kicker">{t("gamePage.reconnectKicker")}</p>
            <h2 id="active-game-title">{t("gamePage.reconnectTitle")}</h2>
            <p>{t("gamePage.reconnectText")}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => window.location.assign(activeGame.path)}>
                {t("gamePage.reconnect")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setActiveGame(null)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </section>
        </div>
      )}

      {activePanel === "game-menu" && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirm-modal game-mode-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-mode-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label={t("common.close")}
              onClick={() => setActivePanel("profile")}
            >
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
            <p className="profile-kicker">{t("game.setup")}</p>
            <h2 id="game-mode-title">{t("game.chooseMode")}</h2>
            <div className="game-choice-grid" aria-label={t("game.chooseMode")}>
              <button type="button" onClick={selectCreateLobby}>
                {t("game.create")}
              </button>
              <button type="button" onClick={selectJoinLobby}>
                {t("game.join")}
              </button>
            </div>
          </section>
        </div>
      )}

      {isSettingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirm-modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label={t("common.close")}
              onClick={() => setIsSettingsOpen(false)}
            >
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
            <p className="profile-kicker">{t("settings.kicker")}</p>
            <h2 id="settings-title">{t("settings.title")}</h2>

            <div className="sound-setting">
              <div className="sound-setting-copy">
                <span className="sound-setting-icon" aria-hidden="true">
                  {audioPreferences.enabled ? (
                    <Volume2 size={22} strokeWidth={2} />
                  ) : (
                    <VolumeX size={22} strokeWidth={2} />
                  )}
                </span>
                <span>
                  <strong>{t("settings.sound")}</strong>
                  <small>{t("settings.soundDescription")}</small>
                </span>
              </div>
              <label className="sound-switch" data-ui-sound>
                <input
                  type="checkbox"
                  role="switch"
                  checked={audioPreferences.enabled}
                  aria-label={t("settings.sound")}
                  onChange={toggleSound}
                />
                <span className="sound-switch-track" aria-hidden="true">
                  <span />
                </span>
              </label>
            </div>

            <label className="volume-setting">
              <span>
                <strong>{t("settings.musicVolume")}</strong>
                <output>
                  {volumeToPercent(
                    audioPreferences.musicVolume,
                    MAX_MUSIC_VOLUME
                  )}%
                </output>
              </span>
              <input
                type="range"
                min={MIN_VOLUME_PERCENT}
                max={MAX_VOLUME_PERCENT}
                step="1"
                value={volumeToPercent(
                  audioPreferences.musicVolume,
                  MAX_MUSIC_VOLUME
                )}
                disabled={!audioPreferences.enabled}
                aria-label={t("settings.musicVolume")}
                onChange={changeMusicVolume}
              />
            </label>

            <label className="volume-setting">
              <span>
                <strong>{t("settings.effectsVolume")}</strong>
                <output>
                  {volumeToPercent(
                    audioPreferences.effectsVolume,
                    MAX_EFFECTS_VOLUME
                  )}%
                </output>
              </span>
              <input
                type="range"
                min={MIN_VOLUME_PERCENT}
                max={MAX_VOLUME_PERCENT}
                step="1"
                value={volumeToPercent(
                  audioPreferences.effectsVolume,
                  MAX_EFFECTS_VOLUME
                )}
                disabled={!audioPreferences.enabled}
                aria-label={t("settings.effectsVolume")}
                onChange={changeEffectsVolume}
              />
            </label>
            <p className="settings-auto-save">{t("settings.autoSave")}</p>
            <button
              type="button"
              className="settings-logout-button"
              disabled={isLoggingOut}
              onClick={logout}
            >
              <LogOut aria-hidden="true" size={18} strokeWidth={2} />
              <span>
                {isLoggingOut
                  ? t("settings.loggingOut")
                  : t("settings.logout")}
              </span>
            </button>
          </section>
        </div>
      )}

      {isHowToPlayOpen && (
        <HowToPlayModal onClose={() => setIsHowToPlayOpen(false)} t={t} />
      )}

      <main className="user-shell" aria-label={t("profile.pageLabel")}>
        <section className="profile-sidebar" aria-label={t("profile.userData")}>
          {status === "loading" && (
            <p className="profile-state">{t("common.loadingProfile")}</p>
          )}

          {status === "error" && (
            <div className="profile-state">
              <p>{error}</p>
              <a href="/">{t("common.backHome")}</a>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="profile-identity">
                <div className="profile-avatar" aria-hidden="true">
                  <img src={defaultUserAvatar} alt="" />
                </div>
                <div>
                  <p className="profile-kicker">{t("profile.runnerProfile")}</p>
                  <h1>
                    <button
                      type="button"
                      className="profile-name-link"
                      onClick={openProfilePanel}
                    >
                      {user.username || t("profile.unknownUser")}
                    </button>
                  </h1>
                  <p className="profile-username">@{user.username}</p>
                </div>
              </div>

              <div className="profile-stats" aria-label={t("profile.stats")}>
                <div>
                  <strong>{user.matches_played ?? 0}</strong>
                  <span>{t("profile.matchesPlayed")}</span>
                </div>
                <div>
                  <strong>{user.wins ?? 0}</strong>
                  <span>{t("profile.wins")}</span>
                </div>
              </div>

              <div className="profile-actions" aria-label={t("profile.actions")}>
                {actions.map((action) => {
                  const Icon = action.icon;
                  const isStartAction = action.id === "start-game";
                  const isStartDisabled =
                    isStartAction &&
                    (Boolean(gameScenario) ||
                      activePanel === "game-menu" ||
                      activePanel === "create-lobby" ||
                      activePanel === "join-lobby");
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={isStartDisabled}
                      onClick={() => handleAction(action)}
                    >
                      {Icon && <Icon aria-hidden="true" size={18} strokeWidth={2} />}
                      <span>
                        {isStartAction
                          ? startGameLabel
                          : action.id === "how-to-play"
                            ? t("actions.howToPlay")
                            : action.id === "settings"
                              ? t("actions.settings")
                              : action.id}
                      </span>
                    </button>
                  );
                })}

                <div className="language-switcher" aria-label={t("actions.language")}>
                  <button
                    type="button"
                    className={language === "uk" ? "active" : ""}
                    aria-pressed={language === "uk"}
                    onClick={() => setLanguage("uk")}
                  >
                    УКР
                  </button>
                  <button
                    type="button"
                    className={language === "en" ? "active" : ""}
                    aria-pressed={language === "en"}
                    onClick={() => setLanguage("en")}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={language === "de" ? "active" : ""}
                    aria-pressed={language === "de"}
                    onClick={() => setLanguage("de")}
                  >
                    DE
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="user-stage" aria-label={t("stage.title")}>
          {renderStageContent()}
        </section>
      </main>
      <span className="user-page-version">Patch v{packageMetadata.version}</span>
    </div>
  );
}
