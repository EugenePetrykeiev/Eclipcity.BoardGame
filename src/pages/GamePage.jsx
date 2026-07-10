import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import {
  getGameDetails,
  heartbeatGame,
  leaveGameById
} from "../services/authClient.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { cardBackImage, gameItems } from "../assets/game/gameAssets.js";

const gamePathPattern =
  /^\/game\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

const teamColors = {
  green: "#B6FF00",
  purple: "#7B2FFF",
  orange: "#FF5A1F",
  pink: "#FF2E9A",
  turquoise: "#00F5D4"
};

const tunnelSegments = [
  [1, 0, 3],
  [0, -1, 2],
  [1, 0, 3],
  [0, 1, 2],
  [1, 0, 3],
  [0, -1, 3],
  [-1, 0, 2],
  [0, -1, 2],
  [1, 0, 3],
  [0, 1, 2],
  [1, 0, 2],
  [0, -1, 3],
  [-1, 0, 3],
  [0, -1, 2],
  [-1, 0, 3],
  [0, 1, 2],
  [-1, 0, 3],
  [0, 1, 3]
];

function gameIdFromPath() {
  return window.location.pathname.match(gamePathPattern)?.[1] || null;
}

function userHomePath(userId) {
  return userId ? `/user/${userId}` : "/";
}

function buildTunnelCoordinates(count) {
  let x = 0;
  let y = 8;
  const coordinates = [{ x, y }];

  for (const [dx, dy, steps] of tunnelSegments) {
    for (let index = 0; index < steps; index += 1) {
      x += dx;
      y += dy;
      coordinates.push({ x, y });
      if (coordinates.length === count) {
        return coordinates;
      }
    }
  }

  return coordinates;
}

function toBoardPoint(coordinate) {
  return {
    x: 7 + coordinate.x * (86 / 12),
    y: 8 + coordinate.y * (80 / 8)
  };
}

function RunnerToken({ teamColor, title }) {
  return (
    <span className="runner-token" style={{ "--team-color": teamColor }} title={title}>
      <svg viewBox="0 0 40 52" role="img" aria-label={title}>
        <path
          d="M20 4 8 11v16c0 9 5 16 12 21 7-5 12-12 12-21V11L20 4Z"
          fill="var(--team-color)"
          opacity="0.26"
        />
        <path
          d="M20 7a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-9 22c0-5 4-8 9-8s9 3 9 8v15H11V29Z"
          fill="var(--team-color)"
        />
        <path
          d="M16 28h8v16h-8z"
          fill="#0A0E14"
          opacity="0.38"
        />
      </svg>
    </span>
  );
}

function PlayerCardBacks({ count }) {
  const visibleCards = Math.min(count, 6);
  return (
    <div className="player-card-backs" aria-hidden="true">
      {Array.from({ length: visibleCards }).map((_, index) => (
        <img
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          src={cardBackImage}
          alt=""
          style={{ marginLeft: index === 0 ? 0 : -13 }}
        />
      ))}
    </div>
  );
}

export default function GamePage() {
  const { t } = useI18n();
  const [game, setGame] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const gameId = useMemo(() => gameIdFromPath(), []);
  const itemMap = useMemo(
    () => new Map(gameItems.map((item) => [item.id, item])),
    []
  );

  useEffect(() => {
    let isMounted = true;

    async function loadGame() {
      if (!gameId) {
        setStatus("error");
        setError(t("gamePage.invalidRoute"));
        return;
      }

      try {
        const payload = await getGameDetails(gameId);
        if (!isMounted) {
          return;
        }
        setGame(payload);
        setStatus("ready");
      } catch (requestError) {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setError(requestError.message || t("gamePage.loadError"));
      }
    }

    loadGame();

    return () => {
      isMounted = false;
    };
  }, [gameId, t]);

  useEffect(() => {
    if (status !== "ready" || !gameId) {
      return undefined;
    }

    let isPolling = true;
    const ping = async () => {
      try {
        const payload = await heartbeatGame(gameId);
        if (isPolling) {
          setGame(payload);
        }
      } catch (requestError) {
        if (isPolling) {
          setError(requestError.message || t("gamePage.connectionLost"));
        }
      }
    };

    const intervalId = window.setInterval(ping, 10000);
    return () => {
      isPolling = false;
      window.clearInterval(intervalId);
    };
  }, [gameId, status, t]);

  async function leaveCurrentGame() {
    if (!game) {
      return;
    }

    try {
      const result = await leaveGameById(game.id);
      window.location.assign(result.next || userHomePath(game.current_user_id));
    } catch (requestError) {
      setError(requestError.message || t("gamePage.leaveError"));
    }
  }

  if (status === "loading") {
    return (
      <main className="game-page">
        <p className="game-state">{t("gamePage.loading")}</p>
      </main>
    );
  }

  if (status === "error" || !game) {
    return (
      <main className="game-page">
        <section className="game-error-panel">
          <p className="profile-kicker">{t("gamePage.accessDenied")}</p>
          <h1>{t("gamePage.unavailable")}</h1>
          <p>{error}</p>
          <a href="/">{t("common.backHome")}</a>
        </section>
      </main>
    );
  }

  const coordinates = buildTunnelCoordinates(game.route_tiles.length);
  const boardPoints = coordinates.map(toBoardPoint);
  const pathPoints = boardPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const startPoint = boardPoints[0];
  const exitPoint = boardPoints.at(-1);

  return (
    <main className="game-page" aria-label={t("gamePage.label")}>
      <header className="game-topbar">
        <div>
          <p className="profile-kicker">{t("gamePage.kicker")}</p>
          <h1>{game.lobby_name}</h1>
          <span>{t("gamePage.lobbyCode", { code: game.lobby_code })}</span>
        </div>
        <div className="game-topbar-actions">
          <a href={userHomePath(game.current_user_id)}>
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
            {t("gamePage.profile")}
          </a>
          <button type="button" onClick={leaveCurrentGame}>
            <LogOut aria-hidden="true" size={18} strokeWidth={2} />
            {t("gamePage.leave")}
          </button>
        </div>
      </header>

      {error && <p className="game-inline-error">{error}</p>}

      <section className="game-layout">
        <section className="game-table-shell" aria-label={t("gamePage.table")}>
          <div className="game-table-perspective">
            <div className="game-table">
              <svg
                className="tunnel-lines"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline points={pathPoints} />
              </svg>

              <div
                className="start-hatch"
                style={{ left: `${startPoint.x}%`, top: `${startPoint.y}%` }}
              >
                <span>{t("gamePage.start")}</span>
                <div className="start-runners">
                  {game.players
                    .filter((player) => player.status !== "removed")
                    .map((player) => (
                      <RunnerToken
                        key={player.user_id}
                        teamColor={teamColors[player.team_color]}
                        title={player.nickname}
                      />
                    ))}
                </div>
              </div>

              <div
                className="exit-gate"
                style={{ left: `${exitPoint.x}%`, top: `${exitPoint.y}%` }}
              >
                <span>{t("gamePage.exit")}</span>
              </div>

              {game.route_tiles.map((tile, index) => {
                const point = boardPoints[index];
                const item = itemMap.get(tile.item_id);
                return (
                  <button
                    type="button"
                    key={`${tile.index}-${tile.item_id}`}
                    className="tunnel-tile"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    title={item?.nameUk || tile.item_id}
                  >
                    <span className="tile-index">{tile.index}</span>
                    {item && <img src={item.itemImage} alt="" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="game-player-panel" aria-label={t("gamePage.players")}>
          <div className="game-panel-header">
            <p className="profile-kicker">{t("gamePage.players")}</p>
            <strong>{game.players.length}</strong>
          </div>
          <div className="game-player-list">
            {game.players.map((player) => (
              <article className={`game-player-card ${player.status}`} key={player.user_id}>
                <div className="game-player-line">
                  <RunnerToken
                    teamColor={teamColors[player.team_color]}
                    title={player.nickname}
                  />
                  <div>
                    <h2>{player.nickname}</h2>
                    <p>
                      {t("gamePage.cardsCount", { count: player.card_count })}
                      {player.is_host ? ` · ${t("gamePage.host")}` : ""}
                    </p>
                  </div>
                  <span>{player.turn_order}</span>
                </div>
                <PlayerCardBacks count={player.card_count} />
                {player.status === "disconnected" && (
                  <p className="disconnect-timer">
                    {t("gamePage.reconnectTimer", {
                      seconds: player.disconnect_seconds_remaining ?? 0
                    })}
                  </p>
                )}
                {player.status === "removed" && (
                  <p className="disconnect-timer">{t("gamePage.removed")}</p>
                )}
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
