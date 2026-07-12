import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import {
  getGameDetails,
  heartbeatGame,
  leaveGameById
} from "../services/authClient.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import {
  cardBackImage,
  gameItems,
  prisonerPawnImage
} from "../assets/game/gameAssets.js";

const gamePathPattern =
  /^\/game\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

const teamColors = {
  green: "#B6FF00",
  purple: "#7B2FFF",
  orange: "#FF5A1F",
  pink: "#FF2E9A",
  turquoise: "#00F5D4"
};

const tunnelShapes = [
  {
    start: { x: 1, y: 6 },
    segments: [[1, 0, 2], [0, -1, 2], [-1, 0, 2], [0, -1, 3], [1, 0, 3], [0, 1, 2], [1, 0, 2], [0, -1, 2], [1, 0, 2], [0, 1, 3], [1, 0, 3], [0, 1, 3], [-1, 0, 2], [0, -1, 2], [-1, 0, 2], [0, 1, 2], [-1, 0, 2], [0, -1, 3], [1, 0, 2]]
  },
  {
    start: { x: 1, y: 7 },
    segments: [[0, -1, 3], [1, 0, 2], [0, 1, 3], [1, 0, 3], [0, -1, 2], [-1, 0, 2], [0, -1, 2], [-1, 0, 2], [0, -1, 2], [1, 0, 3], [0, 1, 2], [1, 0, 2], [0, -1, 2], [1, 0, 2], [0, 1, 2], [1, 0, 2], [0, 1, 2], [-1, 0, 3], [0, 1, 2], [1, 0, 3]]
  },
  {
    start: { x: 1, y: 6 },
    segments: [[0, -1, 2], [1, 0, 2], [0, 1, 3], [1, 0, 2], [0, -1, 3], [1, 0, 2], [0, 1, 2], [1, 0, 2], [0, -1, 2], [1, 0, 2], [0, -1, 3], [-1, 0, 2], [0, 1, 2], [-1, 0, 2], [0, -1, 2], [-1, 0, 2], [0, 1, 2], [-1, 0, 3], [0, -1, 2], [1, 0, 2]]
  },
  {
    start: { x: 1, y: 7 },
    segments: [[1, 0, 2], [0, -1, 3], [-1, 0, 2], [0, -1, 3], [1, 0, 2], [0, 1, 2], [1, 0, 2], [0, -1, 2], [1, 0, 3], [0, 1, 3], [-1, 0, 3], [0, 1, 3], [1, 0, 2], [0, -1, 2], [1, 0, 2], [0, -1, 2], [1, 0, 2], [0, -1, 2], [-1, 0, 2]]
  },
  {
    start: { x: 1, y: 7 },
    segments: [[1, 0, 3], [0, -1, 2], [-1, 0, 3], [0, -1, 3], [1, 0, 3], [0, 1, 2], [1, 0, 3], [0, -1, 3], [1, 0, 3], [0, 1, 2], [-1, 0, 2], [0, 1, 2], [-1, 0, 2], [0, 1, 2], [1, 0, 3], [0, -1, 3], [1, 0, 2], [0, -1, 3]]
  },
  {
    start: { x: 2, y: 7 },
    segments: [[1, 0, 3], [0, -1, 2], [1, 0, 2], [0, 1, 2], [1, 0, 2], [0, -1, 2], [1, 0, 2], [0, -1, 3], [-1, 0, 2], [0, 1, 2], [-1, 0, 2], [0, -1, 3], [-1, 0, 3], [0, 1, 2], [-1, 0, 3], [0, 1, 3], [1, 0, 2], [0, -1, 2], [1, 0, 3]]
  },
  {
    start: { x: 2, y: 7 },
    segments: [[1, 0, 3], [0, -1, 2], [1, 0, 3], [0, 1, 2], [1, 0, 3], [0, -1, 2], [-1, 0, 2], [0, -1, 2], [1, 0, 2], [0, -1, 2], [-1, 0, 3], [0, 1, 3], [-1, 0, 2], [0, -1, 3], [-1, 0, 2], [0, 1, 2], [-1, 0, 3], [0, -1, 2], [1, 0, 2]]
  },
  {
    start: { x: 2, y: 7 },
    segments: [[1, 0, 3], [0, -1, 2], [1, 0, 3], [0, 1, 2], [1, 0, 3], [0, -1, 3], [-1, 0, 3], [0, -1, 3], [-1, 0, 3], [0, 1, 2], [-1, 0, 2], [0, -1, 2], [-1, 0, 2], [0, 1, 3], [1, 0, 3], [0, 1, 2], [-1, 0, 3]]
  },
  {
    start: { x: 1, y: 6 },
    segments: [[1, 0, 2], [0, -1, 2], [-1, 0, 2], [0, -1, 3], [1, 0, 2], [0, 1, 2], [1, 0, 3], [0, 1, 2], [-1, 0, 2], [0, 1, 2], [1, 0, 3], [0, -1, 2], [1, 0, 2], [0, 1, 2], [1, 0, 2], [0, -1, 3], [-1, 0, 2], [0, -1, 3], [1, 0, 2], [0, 1, 2]]
  },
  {
    start: { x: 2, y: 7 },
    segments: [[0, -1, 3], [1, 0, 2], [0, -1, 3], [1, 0, 2], [0, 1, 3], [1, 0, 2], [0, -1, 3], [1, 0, 3], [0, 1, 2], [-1, 0, 2], [0, 1, 2], [1, 0, 2], [0, 1, 2], [-1, 0, 3], [0, -1, 2], [-1, 0, 2], [0, 1, 2], [-1, 0, 3], [0, -1, 2]]
  }
];

function gameIdFromPath() {
  return window.location.pathname.match(gamePathPattern)?.[1] || null;
}

function userHomePath(userId) {
  return userId ? `/user/${userId}` : "/";
}

function buildTunnelCoordinates(count, shapeId = 0) {
  const shape = tunnelShapes[shapeId % tunnelShapes.length] || tunnelShapes[0];
  let x = shape.start.x;
  let y = shape.start.y;
  const coordinates = [{ x, y }];

  for (const [dx, dy, steps] of shape.segments) {
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
    x: 16 + coordinate.x * (78 / 12),
    y: 6 + coordinate.y * (84 / 8)
  };
}

function clampBoardPoint(point) {
  return {
    x: Math.min(94, Math.max(6, point.x)),
    y: Math.min(94, Math.max(6, point.y))
  };
}

function markerBefore(firstPoint, secondPoint) {
  return clampBoardPoint({
    x: firstPoint.x + (firstPoint.x - secondPoint.x) * 1.6,
    y: firstPoint.y + (firstPoint.y - secondPoint.y) * 1.6
  });
}

function markerAfter(previousPoint, lastPoint) {
  return clampBoardPoint({
    x: lastPoint.x + (lastPoint.x - previousPoint.x) * 1.6,
    y: lastPoint.y + (lastPoint.y - previousPoint.y) * 1.6
  });
}

function pointKey(point) {
  return `${Math.round(point.x * 10) / 10}:${Math.round(point.y * 10) / 10}`;
}

function distanceToClosestPoint(point, points) {
  return Math.min(...points.map((routePoint) => Math.hypot(point.x - routePoint.x, point.y - routePoint.y)));
}

function findExitTilePoint(previousPoint, lastPoint, routePoints) {
  const vector = {
    x: lastPoint.x - previousPoint.x,
    y: lastPoint.y - previousPoint.y
  };
  const distance = Math.hypot(vector.x, vector.y) || 1;
  const direction = {
    x: vector.x / distance,
    y: vector.y / distance
  };
  const perpendicular = {
    x: -direction.y,
    y: direction.x
  };
  const usedRoutePoints = new Set(routePoints.map(pointKey));
  const candidates = [
    { forward: 1, side: 0 },
    { forward: 2, side: 0 },
    { forward: 0, side: 1 },
    { forward: 0, side: -1 },
    { forward: -1, side: 0 }
  ]
    .map(({ forward, side }) => ({
      x: lastPoint.x + direction.x * 6.5 * forward + perpendicular.x * 6.5 * side,
      y: lastPoint.y + direction.y * 10.5 * forward + perpendicular.y * 10.5 * side,
      forward,
      side
    }))
    .filter((point) => point.x >= 11 && point.x <= 89 && point.y >= 13 && point.y <= 87)
    .filter((point) => !usedRoutePoints.has(pointKey(point)))
    .map((point) => ({
      point,
      closestTileDistance: distanceToClosestPoint(point, routePoints)
    }))
    .filter((candidate) => candidate.closestTileDistance >= 6.5)
    .sort(
      (first, second) =>
        Math.abs(first.point.forward - 1) - Math.abs(second.point.forward - 1) ||
        Math.abs(first.point.side) - Math.abs(second.point.side) ||
        second.closestTileDistance - first.closestTileDistance
    );

  return candidates[0]?.point || markerAfter(previousPoint, lastPoint);
}

function startApproachArrow(startPoint) {
  const y = startPoint.y;
  const endX = startPoint.x - 1.85;
  const headBaseX = endX - 1.45;
  const startX = Math.max(11, headBaseX - 5.4);

  return {
    line: {
      x1: startX,
      y1: y,
      x2: headBaseX,
      y2: y
    },
    head: `${headBaseX},${y - 0.85} ${endX},${y} ${headBaseX},${y + 0.85}`
  };
}

function getCurrentTurnPlayer(players) {
  return [...players]
    .filter((player) => player.status !== "removed" && player.status !== "left")
    .sort((a, b) => a.turn_order - b.turn_order)[0];
}

function hashString(value) {
  return [...value].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973,
    7
  );
}

function topSeatStyle(index, total) {
  return {
    "--seat-index": index,
    "--seat-count": total
  };
}

function startSlotStyle(player, index, total) {
  const slots = [
    [50, 52],
    [27, 31],
    [73, 31],
    [31, 73],
    [69, 73]
  ];
  const slotIndex = index % slots.length;
  const [x, y] = slots[slotIndex];
  const jitter = ((hashString(`${player.user_id}-${total}`) % 5) - 2) * 0.4;

  return [x + jitter, y - jitter];
}

function PawnSilhouette({ teamColor, title, className = "" }) {
  return (
    <span
      className={`pawn-silhouette ${className}`.trim()}
      style={{
        "--team-color": teamColor,
        "--pawn-mask": `url("${prisonerPawnImage}")`
      }}
      title={title}
      role="img"
      aria-label={title}
    />
  );
}

function CardDots({ count }) {
  return (
    <span className="card-dots" aria-label={`${count} cards`}>
      {Array.from({ length: Math.min(count, 12) }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <span key={index} />
      ))}
    </span>
  );
}

function PrisonerProgress({ player }) {
  const total = player.prisoners_total || 7;
  const escaped = player.escaped_prisoners || 0;
  const teamColor = teamColors[player.team_color];
  return (
    <span className="prisoner-progress" aria-label={`${escaped}/${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <PawnSilhouette
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          teamColor={teamColor}
          title={`${player.nickname} ${index + 1}`}
          className={index < escaped ? "escaped" : "captive"}
        />
      ))}
    </span>
  );
}

function PlayerCardBacks({ count, compact = false, cards = [] }) {
  const visibleCards = Math.min(count, 6);
  const openCards = cards.slice(0, visibleCards);

  if (openCards.length > 0) {
    return (
      <div className="player-card-backs open" aria-label={`${openCards.length} open cards`}>
        {openCards.map((item, index) => (
          (() => {
            const offset = index - (openCards.length - 1) / 2;
            return (
              <img
                key={`${item.id}-${index}`}
                src={item.cardImage}
                alt={item.nameUk}
                title={item.nameUk}
                style={{
                  "--card-angle": `${offset * 8}deg`,
                  "--card-arc": `${Math.abs(offset) * 5}px`,
                  zIndex: index + 1
                }}
              />
            );
          })()
        ))}
      </div>
    );
  }

  return (
    <div className={`player-card-backs ${compact ? "compact" : ""}`} aria-hidden="true">
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

function PlayerSeat({
  player,
  seatClass,
  isCurrent,
  handCards = [],
  isSelf = false,
  style = {}
}) {
  const teamColor = teamColors[player.team_color];
  return (
    <article
      className={`table-player-seat ${seatClass} ${player.status} ${
      isSelf ? "self-seat" : ""
      }`.trim()}
      style={style}
    >
      {isSelf ? (
        isCurrent && (
          <div className="self-turn-row">
            <i className="turn-pulse" aria-label="current turn" />
          </div>
        )
      ) : (
        <div className="seat-name-row">
          <PawnSilhouette teamColor={teamColor} title={player.nickname} />
          <span>{player.nickname}</span>
          {isCurrent && <i className="turn-pulse" aria-label="current turn" />}
        </div>
      )}
      <PlayerCardBacks
        count={player.card_count}
        compact={handCards.length === 0}
        cards={handCards}
      />
    </article>
  );
}

export default function GamePage() {
  const { t } = useI18n();
  const [game, setGame] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedPrisoner, setSelectedPrisoner] = useState(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
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

  useEffect(() => {
    function toggleRosterByTab(event) {
      if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      event.preventDefault();
      setIsRosterOpen((isOpen) => !isOpen);
    }

    window.addEventListener("keydown", toggleRosterByTab);
    return () => window.removeEventListener("keydown", toggleRosterByTab);
  }, []);

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

  const routeShapeId = Number(game.route_tiles[0]?.shape_id || 0);
  const coordinates = buildTunnelCoordinates(game.route_tiles.length, routeShapeId);
  const boardPoints = coordinates.map(toBoardPoint);
  const startPoint = boardPoints[0];
  const exitPoint = boardPoints.at(-1);
  const me = game.players.find((player) => player.user_id === game.current_user_id);
  const opponents = game.players.filter(
    (player) => player.user_id !== game.current_user_id
  );
  const currentTurnPlayer = getCurrentTurnPlayer(game.players);
  const visibleMyHandCards = (me?.hand_cards || [])
    .map((itemId) => itemMap.get(itemId))
    .filter(Boolean);
  const exitTilePoint = findExitTilePoint(boardPoints.at(-2) || exitPoint, exitPoint, boardPoints);
  const tunnelPathPoints = [...boardPoints, exitTilePoint]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const startArrow = startApproachArrow(startPoint);

  return (
    <main className="game-page" aria-label={t("gamePage.label")}>
      <header className="game-topbar">
        <div className="game-topbar-actions">
          <button type="button" className="game-leave-button" onClick={leaveCurrentGame}>
            <LogOut aria-hidden="true" size={18} strokeWidth={2} />
            <span>{t("gamePage.leave")}</span>
          </button>
        </div>
      </header>

      {error && <p className="game-inline-error">{error}</p>}

      <section className="game-layout">
        <aside
          className={`game-roster ${isRosterOpen ? "open" : ""}`}
          aria-label={t("gamePage.players")}
        >
          <button
            type="button"
            className="roster-toggle"
            aria-label={t("gamePage.players")}
            aria-expanded={isRosterOpen}
            onClick={() => setIsRosterOpen((isOpen) => !isOpen)}
          >
            {isRosterOpen ? "‹" : "›"}
          </button>
          <div className="roster-panel">
            <h2>{game.lobby_name}</h2>
            <p className="profile-kicker">{t("gamePage.players")}</p>
            <div className="roster-list">
              {game.players.map((player) => {
                const isCurrent = currentTurnPlayer?.user_id === player.user_id;
                return (
                  <article className={`roster-row ${player.status}`} key={player.user_id}>
                    <div className="roster-name">
                      <span
                        className="team-chip"
                        style={{ "--team-color": teamColors[player.team_color] }}
                      />
                      <strong>{player.nickname}</strong>
                      {player.user_id === game.current_user_id && (
                        <em>{t("gamePage.me")}</em>
                      )}
                      {isCurrent && <i className="turn-pulse" />}
                    </div>
                    <CardDots count={player.card_count} />
                    <PrisonerProgress player={player} />
                    {player.status === "disconnected" && (
                      <p className="disconnect-timer">
                        {t("gamePage.reconnectTimer", {
                          seconds: player.disconnect_seconds_remaining ?? 0
                        })}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="game-table-shell" aria-label={t("gamePage.table")}>
          {opponents.map((player, index) => (
            <PlayerSeat
              key={player.user_id}
              player={player}
              seatClass="seat-top-player"
              isCurrent={currentTurnPlayer?.user_id === player.user_id}
              style={topSeatStyle(index, opponents.length)}
            />
          ))}
          {me && (
            <PlayerSeat
              player={me}
              seatClass="seat-bottom-center"
              isCurrent={currentTurnPlayer?.user_id === me.user_id}
              handCards={visibleMyHandCards}
              isSelf
            />
          )}
          <div className="game-table-perspective">
            <div className="game-table">
              <svg
                className="tunnel-lines"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <g className="tunnel-entry-arrow">
                  <line
                    x1={startArrow.line.x1}
                    y1={startArrow.line.y1}
                    x2={startArrow.line.x2}
                    y2={startArrow.line.y2}
                  />
                  <polygon points={startArrow.head} />
                </g>
                <polyline points={tunnelPathPoints} />
              </svg>

              <div className="start-hatch">
                <span>{t("gamePage.start")}</span>
                <div className="start-prisoners" aria-label={t("gamePage.startPrisoners")}>
                  {game.players
                    .filter((player) => player.status !== "removed")
                    .sort(
                      (a, b) =>
                        hashString(`${game.id}-${a.user_id}`) -
                        hashString(`${game.id}-${b.user_id}`)
                    )
                    .map((player, playerIndex, visiblePlayers) => {
                      const [slotX, slotY] = startSlotStyle(
                        player,
                        playerIndex,
                        visiblePlayers.length
                      );
                      const id = `${player.user_id}-leader`;
                      const prisonersLeft = Math.max(
                        0,
                        (player.prisoners_total || 7) - (player.escaped_prisoners || 0)
                      );

                      return (
                        <button
                          type="button"
                          key={id}
                          className={`prisoner-token ${
                            selectedPrisoner === id ? "selected" : ""
                          }`}
                          style={{
                            "--team-color": teamColors[player.team_color],
                            "--pawn-mask": `url("${prisonerPawnImage}")`,
                            left: `${slotX}%`,
                            top: `${slotY}%`,
                            zIndex: 20 + playerIndex
                          }}
                          title={`${player.nickname}: ${prisonersLeft}`}
                          aria-pressed={selectedPrisoner === id}
                          onClick={() => setSelectedPrisoner(id)}
                        >
                          <span className="prisoner-token-shape" aria-hidden="true" />
                          <span className="prisoner-count-badge">{prisonersLeft}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="deck-stack" aria-label="Колода">
                <img src={cardBackImage} alt="" />
                <img src={cardBackImage} alt="" />
                <img src={cardBackImage} alt="" />
                <span>Колода</span>
              </div>

              <div
                className="exit-gate"
                style={{ left: `${exitTilePoint.x}%`, top: `${exitTilePoint.y}%` }}
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
      </section>
    </main>
  );
}
