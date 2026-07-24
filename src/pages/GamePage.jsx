import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LogOut, Users } from "lucide-react";
import {
  endGameTurn,
  getGameDetails,
  heartbeatGame,
  leaveGameById,
  moveGamePrisonerBack,
  playGameCard
} from "../services/authClient.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import {
  cardBackImage,
  gameItems,
  prisonerPawnImage
} from "../assets/game/gameAssets.js";
import { audioManager } from "../services/audioManager.js";

const gamePathPattern =
  /^\/game\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;
const MAX_VISIBLE_HAND_CARDS = 10;

const teamColors = {
  green: "#B6FF00",
  purple: "#7B2FFF",
  orange: "#FF5A1F",
  pink: "#FF2E9A",
  turquoise: "#00F5D4"
};

const boardGrid = {
  centerX: 300,
  centerY: 110,
  coordinateCenterX: 0,
  coordinateCenterY: 0,
  stepX: 80,
  stepY: 80,
  minX: 30,
  maxX: 1890,
  minY: 30,
  maxY: 870,
  unit: "px"
};

const tunnelShapes = [
  {
    start: { x: 0, y: 7 },
    segments: [[1, 0, 4], [0, -1, 3], [-1, 0, 4], [0, -1, 4], [1, 0, 3], [0, 1, 3], [1, 0, 3], [0, 1, 4], [1, 0, 4], [0, -1, 3], [-1, 0, 3], [0, -1, 3], [1, 0, 3]]
  },
  {
    start: { x: 0, y: 7 },
    segments: [[1, 0, 3], [0, -1, 3], [-1, 0, 3], [0, -1, 3], [1, 0, 4], [0, 1, 4], [1, 0, 3], [0, -1, 4], [1, 0, 4], [0, 1, 3], [-1, 0, 3], [0, 1, 3], [-1, 0, 4]]
  },
  {
    start: { x: 0, y: 7 },
    segments: [[1, 0, 3], [0, -1, 3], [-1, 0, 3], [0, -1, 4], [1, 0, 3], [0, 1, 3], [1, 0, 4], [0, -1, 3], [1, 0, 3], [0, 1, 4], [-1, 0, 4], [0, 1, 3], [1, 0, 4]]
  },
  {
    start: { x: 0, y: 7 },
    segments: [[1, 0, 3], [0, -1, 4], [-1, 0, 3], [0, -1, 3], [1, 0, 4], [0, 1, 4], [1, 0, 3], [0, -1, 3], [1, 0, 4], [0, 1, 3], [-1, 0, 3], [0, 1, 3], [-1, 0, 4]]
  },
  {
    start: { x: 0, y: 7 },
    segments: [[1, 0, 3], [0, -1, 3], [-1, 0, 3], [0, -1, 4], [1, 0, 4], [0, 1, 3], [1, 0, 4], [0, -1, 3], [1, 0, 3], [0, 1, 4], [-1, 0, 4], [0, 1, 3], [-1, 0, 3]]
  },
  {
    start: { x: 0, y: 7 },
    segments: [[1, 0, 4], [0, -1, 4], [-1, 0, 3], [0, -1, 3], [1, 0, 4], [0, 1, 4], [1, 0, 3], [0, 1, 3], [1, 0, 3], [0, -1, 4], [-1, 0, 3], [0, -1, 3], [1, 0, 3]]
  },
  {
    start: { x: 0, y: 7 },
    segments: [[1, 0, 3], [0, -1, 3], [-1, 0, 3], [0, -1, 3], [1, 0, 4], [0, 1, 3], [1, 0, 4], [0, 1, 3], [1, 0, 3], [0, -1, 4], [-1, 0, 4], [0, -1, 3], [1, 0, 4]]
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

function toBoardPoint(coordinate, layout = boardGrid) {
  return {
    x: layout.centerX + (coordinate.x - layout.coordinateCenterX) * layout.stepX,
    y: layout.centerY + (coordinate.y - layout.coordinateCenterY) * layout.stepY
  };
}

function clampBoardPoint(point, layout = boardGrid) {
  return {
    x: Math.min(layout.maxX, Math.max(layout.minX, point.x)),
    y: Math.min(layout.maxY, Math.max(layout.minY, point.y))
  };
}

function markerAfter(previousPoint, lastPoint, layout = boardGrid) {
  return clampBoardPoint({
    x: lastPoint.x + (lastPoint.x - previousPoint.x) * 1.6,
    y: lastPoint.y + (lastPoint.y - previousPoint.y) * 1.6
  }, layout);
}

function pointKey(point) {
  return `${Math.round(point.x * 10) / 10}:${Math.round(point.y * 10) / 10}`;
}

function distanceToClosestPoint(point, points) {
  return Math.min(...points.map((routePoint) => Math.hypot(point.x - routePoint.x, point.y - routePoint.y)));
}

function findExitTilePoint(previousPoint, lastPoint, routePoints, layout = boardGrid) {
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
  const otherRoutePoints = routePoints.slice(0, -1);
  const gridStep = Math.min(layout.stepX, layout.stepY);
  const candidates = [
    { forward: 1, side: 0 },
    { forward: 0, side: 1 },
    { forward: 0, side: -1 }
  ]
    .map(({ forward, side }) => ({
      x:
        lastPoint.x +
        direction.x * layout.stepX * forward +
        perpendicular.x * layout.stepX * side,
      y:
        lastPoint.y +
        direction.y * layout.stepY * forward +
        perpendicular.y * layout.stepY * side,
      forward,
      side
    }))
    .filter(
      (point) =>
        point.x >= layout.minX &&
        point.x <= layout.maxX &&
        point.y >= layout.minY &&
        point.y <= layout.maxY
    )
    .filter((point) => !usedRoutePoints.has(pointKey(point)))
    .map((point) => ({
      point,
      closestTileDistance: distanceToClosestPoint(point, otherRoutePoints)
    }))
    .filter(
      (candidate) =>
        candidate.closestTileDistance > gridStep
    )
    .sort(
      (first, second) =>
        Math.abs(first.point.forward - 1) - Math.abs(second.point.forward - 1) ||
        Math.abs(first.point.side) - Math.abs(second.point.side) ||
        second.closestTileDistance - first.closestTileDistance
    );

  return candidates[0]?.point || markerAfter(previousPoint, lastPoint, layout);
}

function findExitGridCoordinate(coordinates) {
  if (coordinates.length < 2) {
    return coordinates[0] || { x: 0, y: 0 };
  }
  const previousPoint = coordinates.at(-2);
  const lastPoint = coordinates.at(-1);
  const direction = {
    x: lastPoint.x - previousPoint.x,
    y: lastPoint.y - previousPoint.y
  };
  const perpendicular = {
    x: -direction.y,
    y: direction.x
  };
  const usedPoints = new Set(coordinates.map(pointKey));
  const otherRoutePoints = coordinates.slice(0, -1);
  const candidates = [
    {
      x: lastPoint.x + direction.x,
      y: lastPoint.y + direction.y
    },
    {
      x: lastPoint.x + perpendicular.x,
      y: lastPoint.y + perpendicular.y
    },
    {
      x: lastPoint.x - perpendicular.x,
      y: lastPoint.y - perpendicular.y
    }
  ];

  return (
    candidates.find(
      (candidate) =>
        !usedPoints.has(pointKey(candidate)) &&
        otherRoutePoints.every(
          (point) =>
            Math.abs(candidate.x - point.x) +
              Math.abs(candidate.y - point.y) >
            1
        )
    ) || {
      x: lastPoint.x + direction.x,
      y: lastPoint.y + direction.y
    }
  );
}

function createBoardLayout(metrics, coordinates = []) {
  if (!metrics.width || !metrics.height || coordinates.length === 0) {
    return boardGrid;
  }

  const edgeInset = metrics.tileSize / 2;
  const exitCoordinate = findExitGridCoordinate(coordinates);
  const levelCoordinates = [...coordinates, exitCoordinate];
  const coordinateXs = levelCoordinates.map((coordinate) => coordinate.x);
  const coordinateYs = levelCoordinates.map((coordinate) => coordinate.y);
  const minCoordinateX = Math.min(...coordinateXs);
  const minCoordinateY = Math.min(...coordinateYs);
  const maxCoordinateX = Math.max(...coordinateXs);
  const maxCoordinateY = Math.max(...coordinateYs);
  const coordinateWidth = Math.max(1, maxCoordinateX - minCoordinateX);
  const coordinateHeight = Math.max(1, maxCoordinateY - minCoordinateY);
  const stepX = 80;
  const stepY = 80;
  const routeWidth = coordinateWidth * stepX;
  const routeHeight = coordinateHeight * stepY;
  const routeLeft = Math.max(edgeInset, (metrics.width - routeWidth) / 2);
  const routeTop = Math.max(edgeInset, (metrics.height - routeHeight) / 2);

  return {
    centerX: routeLeft,
    centerY: routeTop,
    coordinateCenterX: minCoordinateX,
    coordinateCenterY: minCoordinateY,
    stepX,
    stepY,
    minX: edgeInset,
    maxX: metrics.width - edgeInset,
    minY: edgeInset,
    maxY: metrics.height - edgeInset,
    unit: "px"
  };
}

function hashString(value) {
  return [...value].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973,
    7
  );
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

function ItemPopover({ item, language, kind, above = false }) {
  if (!item) {
    return null;
  }
  const isUkrainian = language === "uk";
  const name = isUkrainian ? item.nameUk : item.nameEn;
  const description = isUkrainian ? item.descriptionUk : item.descriptionEn;

  return (
    <span
      className={`item-popover ${above ? "above" : ""}`}
      role="tooltip"
    >
      <strong>{name}</strong>
      {kind === "tile" && <span>{description}</span>}
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

function PlayerCardBacks({
  count,
  compact = false,
  cards = [],
  disabled = false,
  onCardClick = null,
  onCardHover = null,
  onCardLeave = null,
  language = "uk"
}) {
  const visibleCards = Math.min(count, MAX_VISIBLE_HAND_CARDS);
  const openCards = cards.slice(0, visibleCards);
  const cardAngleStep = Math.max(4, 8 - Math.max(0, openCards.length - 6));

  if (openCards.length > 0) {
    return (
      <div className="player-card-backs open" aria-label={`${openCards.length} open cards`}>
        {openCards.map((item, index) => (
          (() => {
            const offset = index - (openCards.length - 1) / 2;
            return (
              <button
                type="button"
                key={`${item.id}-${index}`}
                className="hand-card-button"
                aria-disabled={disabled}
                data-audio-scope="card"
                aria-label={language === "uk" ? item.nameUk : item.nameEn}
                onClick={() => onCardClick?.(item)}
                onPointerEnter={(event) => onCardHover?.(item, event)}
                onPointerLeave={() => onCardLeave?.(item)}
                style={{
                  "--card-angle": `${offset * cardAngleStep}deg`,
                  "--card-arc": `${Math.abs(offset) * 5}px`,
                  zIndex: index + 1
                }}
              >
                <img src={item.cardImage} alt={item.nameUk} />
                <ItemPopover item={item} language={language} kind="card" above />
              </button>
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
  style = {},
  canAct = false,
  onCardClick = null,
  onCardHover = null,
  onCardLeave = null,
  language = "uk"
}) {
  const teamColor = teamColors[player.team_color];
  return (
    <article
      className={`table-player-seat ${seatClass} ${player.status} ${
      isSelf ? "self-seat" : ""
      }`.trim()}
      style={style}
      aria-label={
        isSelf
          ? player.nickname
          : `${player.nickname}: ${player.card_count} cards`
      }
    >
      {isSelf ? (
        <PlayerCardBacks
          count={player.card_count}
          compact={handCards.length === 0}
          cards={handCards}
          disabled={!canAct}
          onCardClick={onCardClick}
          onCardHover={onCardHover}
          onCardLeave={onCardLeave}
          language={language}
        />
      ) : (
        <>
          <div
            className="opponent-player-icon"
            style={{ "--team-color": teamColor }}
            aria-hidden="true"
          >
            <Users size={24} strokeWidth={2} />
            {isCurrent && <i className="turn-pulse" />}
          </div>
          <div className="opponent-card-count" aria-hidden="true">
            <img src={cardBackImage} alt="" />
            <strong>{player.card_count}</strong>
          </div>
        </>
      )}
    </article>
  );
}

function gameActionMessage(message) {
  if (!message) {
    return "Хід неможливий.";
  }

  if (
    message.includes("There is no occupied tile") ||
    message.includes("nearest occupied tile") ||
    message.includes("only to the nearest occupied")
  ) {
    return "Хід неможливий: місце зайняте або недоступне.";
  }

  if (message.includes("Selected card")) {
    return "Цієї карти немає в руці.";
  }

  if (message.includes("Selected prisoner")) {
    return "Спочатку оберіть свого в'язня.";
  }

  if (message.includes("not this player's turn")) {
    return "Зараз хід іншого гравця.";
  }

  if (message.includes("No actions left")) {
    return "Дії на цей хід уже використані.";
  }

  return message;
}

export default function GamePage() {
  const { language, t } = useI18n();
  const [game, setGame] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState(null);
  const [selectedPrisoner, setSelectedPrisoner] = useState(null);
  const [playedCard, setPlayedCard] = useState(null);
  const [movingPrisoner, setMovingPrisoner] = useState(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [acknowledgedResultKey, setAcknowledgedResultKey] = useState("");
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [sparkBurst, setSparkBurst] = useState(null);
  const [deckTiltCount, setDeckTiltCount] = useState(0);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [boardMetrics, setBoardMetrics] = useState({
    width: 0,
    height: 0,
    tileSize: 60
  });
  const audioGameStateRef = useRef({
    handCount: null,
    isMyTurn: false
  });
  const yourTurnTimerRef = useRef(null);
  const sparkTimerRef = useRef(null);
  const boardRef = useRef(null);
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
          setActionNotice({
            id: Date.now(),
            message: gameActionMessage(requestError.message || t("gamePage.connectionLost"))
          });
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
    if (!game?.created_at || game.ended_at || game.status === "closed") {
      return undefined;
    }
    setTimerNow(Date.now());
    const intervalId = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [game?.created_at, game?.ended_at, game?.status]);

  useEffect(() => {
    if (!actionNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionNotice(null);
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  useEffect(() => {
    if (!game) {
      return;
    }

    const currentPlayer = game.players.find(
      (player) => player.user_id === game.current_user_id
    );
    const handCount = currentPlayer?.hand_cards?.length ?? 0;
    const isMyTurnNow =
      game.status === "active" &&
      game.current_turn_user_id === game.current_user_id &&
      currentPlayer?.status !== "finished";
    const previousAudioState = audioGameStateRef.current;
    const cardsWereDrawn =
      (previousAudioState.handCount === null && handCount > 0) ||
      (previousAudioState.handCount !== null &&
        handCount > previousAudioState.handCount);
    const turnJustStarted = isMyTurnNow && !previousAudioState.isMyTurn;

    audioGameStateRef.current = {
      handCount,
      isMyTurn: isMyTurnNow
    };

    if (!isMyTurnNow && yourTurnTimerRef.current) {
      window.clearTimeout(yourTurnTimerRef.current);
      yourTurnTimerRef.current = null;
    }

    if (cardsWereDrawn) {
      audioManager.playEffect("drawCard");
    }

    if (turnJustStarted) {
      if (yourTurnTimerRef.current) {
        window.clearTimeout(yourTurnTimerRef.current);
      }
      if (cardsWereDrawn) {
        yourTurnTimerRef.current = window.setTimeout(() => {
          audioManager.playEffect("yourTurn");
          yourTurnTimerRef.current = null;
        }, 700);
      } else {
        audioManager.playEffect("yourTurn");
      }
    }
  }, [game]);

  useEffect(() => {
    return () => {
      if (yourTurnTimerRef.current) {
        window.clearTimeout(yourTurnTimerRef.current);
      }
      if (sparkTimerRef.current) {
        window.clearTimeout(sparkTimerRef.current);
      }
      audioGameStateRef.current = {
        handCount: null,
        isMyTurn: false
      };
    };
  }, []);

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

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || status !== "ready") {
      return undefined;
    }

    function updateBoardMetrics() {
      const bounds = board.getBoundingClientRect();
      const tileSize =
        Number.parseFloat(
          window.getComputedStyle(board).getPropertyValue("--tile-size")
        ) || 60;
      const nextMetrics = {
        width: Math.round(bounds.width * 10) / 10,
        height: Math.round(bounds.height * 10) / 10,
        tileSize: Math.round(tileSize * 10) / 10
      };
      setBoardMetrics((currentMetrics) =>
        currentMetrics.width === nextMetrics.width &&
        currentMetrics.height === nextMetrics.height &&
        currentMetrics.tileSize === nextMetrics.tileSize
          ? currentMetrics
          : nextMetrics
      );
    }

    updateBoardMetrics();
    const observer = new ResizeObserver(updateBoardMetrics);
    observer.observe(board);
    return () => observer.disconnect();
  }, [status]);

  async function leaveCurrentGame() {
    if (!game) {
      return;
    }

    try {
      const result = await leaveGameById(game.id);
      window.location.assign(result.next || userHomePath(game.current_user_id));
    } catch (requestError) {
      if (game.current_user_id) {
        window.location.assign(userHomePath(game.current_user_id));
        return;
      }
      setActionNotice({
        id: Date.now(),
        message: gameActionMessage(requestError.message || t("gamePage.leaveError"))
      });
    }
  }

  async function runGameAction(action, options = {}) {
    if (isActionPending) {
      return;
    }

    setIsActionPending(true);
    try {
      const previousGame = game;
      const payload = await action();
      const movement = options.prisonerId
        ? buildMovementPath(previousGame, payload, options.prisonerId)
        : null;
      const movedPrisoner = options.prisonerId
        ? didOwnedPrisonerMove(previousGame, payload, options.prisonerId)
        : false;
      const escapedPrisoner = options.prisonerId
        ? didPrisonerEscape(previousGame, payload, options.prisonerId)
        : false;
      const movementEffect = escapedPrisoner ? "escape" : "moveUnit";
      options.onSuccess?.(payload);
      if (movement) {
        setMovingPrisoner(movement);
        window.setTimeout(() => {
          setGame(payload);
          setMovingPrisoner(null);
          if (movedPrisoner) {
            window.requestAnimationFrame(() => audioManager.playEffect(movementEffect));
          }
        }, 680);
      } else {
        setGame(payload);
        if (movedPrisoner) {
          window.requestAnimationFrame(() => audioManager.playEffect(movementEffect));
        }
      }
      setSelectedPrisoner(null);
    } catch (requestError) {
      setActionNotice({
        id: Date.now(),
        message: gameActionMessage(requestError.message || "Game action failed.")
      });
    } finally {
      setIsActionPending(false);
    }
  }

  async function handleCardClick(item) {
    audioManager.playEffect("clickCard");
    if (!game || !selectedPrisoner || !canUseActions) {
      setActionNotice({
        id: Date.now(),
        message: "Оберіть в'язня перед картою."
      });
      return;
    }

    await runGameAction(() =>
      playGameCard(game.id, {
        prisoner_id: selectedPrisoner,
        card_id: item.id
      }),
      {
        prisonerId: selectedPrisoner,
        onSuccess: () => {
          setPlayedCard(item);
          audioManager.playEffect("playCard");
          window.setTimeout(() => setPlayedCard(null), 760);
        }
      }
    );
  }

  function handleCardHover(item, event) {
    setHoveredCardId(item.id);
    if (event.pointerType !== "touch") {
      audioManager.playEffect("selectCard");
    }
  }

  function handleCardLeave() {
    setHoveredCardId(null);
  }

  function selectPrisoner(prisonerId) {
    audioManager.playEffect("pickUnit");
    setSelectedPrisoner(prisonerId);
  }

  function handleBoardClick(event) {
    const boardRect = event.currentTarget.getBoundingClientRect();
    const sparkId = Date.now();
    const sparkCount = 8;
    setSparkBurst({
      id: sparkId,
      x: event.clientX - boardRect.left,
      y: event.clientY - boardRect.top,
      particles: Array.from({ length: sparkCount }, (_, index) => {
        const angle = (Math.PI * 2 * index) / sparkCount + (index % 2) * 0.18;
        const distance = 18 + (index % 3) * 7;
        return {
          id: `${sparkId}-${index}`,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          delay: index * 12
        };
      })
    });
    if (sparkTimerRef.current) {
      window.clearTimeout(sparkTimerRef.current);
    }
    sparkTimerRef.current = window.setTimeout(() => {
      setSparkBurst(null);
      sparkTimerRef.current = null;
    }, 620);

    if (event.target.closest(".tunnel-tile, .prisoner-token")) {
      return;
    }
    audioManager.playEffect("clickBoard");
  }

  async function handleTileClick(tileIndex) {
    if (!game || !selectedPrisoner || !canUseActions) {
      return;
    }

    await runGameAction(() =>
      moveGamePrisonerBack(game.id, {
        prisoner_id: selectedPrisoner,
        target_tile_index: tileIndex
      }),
      { prisonerId: selectedPrisoner }
    );
  }

  async function handleStartReturn() {
    if (!game || !selectedPrisoner || !canUseActions) {
      return;
    }

    await runGameAction(() =>
      moveGamePrisonerBack(game.id, {
        prisoner_id: selectedPrisoner,
        target_tile_index: 0
      }),
      { prisonerId: selectedPrisoner }
    );
  }

  async function handleEndTurn() {
    if (!game || !canUseActions) {
      return;
    }

    await runGameAction(() => endGameTurn(game.id));
  }

  function continueAsObserver() {
    if (!resultModalKey) {
      return;
    }
    window.sessionStorage.setItem(resultModalKey, "acknowledged");
    setAcknowledgedResultKey(resultModalKey);
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
  const hasServerCoordinates = game.route_tiles.every(
    (tile) => Number.isInteger(tile.grid_x) && Number.isInteger(tile.grid_y)
  );
  const coordinates = hasServerCoordinates
    ? game.route_tiles.map((tile) => ({ x: tile.grid_x, y: tile.grid_y }))
    : buildTunnelCoordinates(game.route_tiles.length, routeShapeId);
  const boardLayout = createBoardLayout(boardMetrics, coordinates);
  const boardPoints = coordinates.map((coordinate) =>
    toBoardPoint(coordinate, boardLayout)
  );
  const boardPointUnit = boardLayout.unit;
  const startPoint = boardPoints[0];
  const exitPoint = boardPoints.at(-1);
  const me = game.players.find((player) => player.user_id === game.current_user_id);
  const opponents = game.players.filter(
    (player) => player.user_id !== game.current_user_id
  );
  const currentTurnPlayer = game.players.find(
    (player) => player.user_id === game.current_turn_user_id
  );
  const finishedPlayers = game.players
    .filter((player) => player.finish_order)
    .sort((first, second) => first.finish_order - second.finish_order);
  const firstFinisher = finishedPlayers[0] || null;
  const resultModalKey = me?.finish_order
    ? `eclipcity:${game.id}:finished:${me.finish_order}`
    : firstFinisher
      ? `eclipcity:${game.id}:first-finish:${firstFinisher.user_id}`
      : "";
  const isResultAcknowledged = Boolean(resultModalKey)
    && (acknowledgedResultKey === resultModalKey
      || window.sessionStorage.getItem(resultModalKey) === "acknowledged");
  const shouldShowResultModal = Boolean(resultModalKey) && !isResultAcknowledged;
  const isMyTurn =
    game.status === "active" &&
    game.current_turn_user_id === game.current_user_id &&
    me?.status !== "finished";
  const canUseActions =
    game.status === "active" && isMyTurn && !isActionPending && !shouldShowResultModal;
  const actionsTaken = game.actions_taken ?? 0;
  const actionsPerTurn = game.actions_per_turn ?? 3;
  const startPrisonerByPlayer = new Map();
  const startCountByPlayer = new Map();
  const prisonersByTile = new Map();
  const rescuedPlayers = game.players.filter((player) => player.escaped_prisoners > 0);
  const winningPlayers = finishedPlayers.filter((player) => player.finish_order === 1);
  const resultKind = me?.finish_order === 1
    ? "victory"
    : me?.finish_order
      ? "finished"
      : firstFinisher
        ? "loss"
      : "";
  const timerEnd = game.ended_at ? new Date(game.ended_at).getTime() : timerNow;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((timerEnd - new Date(game.created_at).getTime()) / 1000)
  );
  const elapsedTime = `${String(Math.floor(elapsedSeconds / 60)).padStart(
    2,
    "0"
  )}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  for (const prisoner of game.prisoners || []) {
    if (prisoner.position === "start") {
      const ownerId = String(prisoner.owner_user_id);
      startCountByPlayer.set(ownerId, (startCountByPlayer.get(ownerId) || 0) + 1);
      if (!startPrisonerByPlayer.has(ownerId)) {
        startPrisonerByPlayer.set(ownerId, prisoner);
      }
    } else if (Number.isInteger(prisoner.position)) {
      const prisoners = prisonersByTile.get(prisoner.position) || [];
      prisoners.push(prisoner);
      prisonersByTile.set(prisoner.position, prisoners);
    }
  }
  const visibleMyHandCards = (me?.hand_cards || [])
    .map((itemId) => itemMap.get(itemId))
    .filter(Boolean);
  const exitTilePoint = findExitTilePoint(
    boardPoints.at(-2) || exitPoint,
    exitPoint,
    boardPoints,
    boardLayout
  );
  const tunnelPathPoints = [...boardPoints, exitTilePoint]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  function pointForPosition(position) {
    if (position === "start") {
      return startPoint;
    }
    if (position === "exit") {
      return exitTilePoint;
    }
    return boardPoints[position - 1];
  }

  function routePointsBetween(fromPosition, toPosition) {
    if (fromPosition === "start" && Number.isInteger(toPosition)) {
      return boardPoints.slice(0, toPosition);
    }
    if (Number.isInteger(fromPosition) && toPosition === "exit") {
      return [...boardPoints.slice(fromPosition - 1), exitTilePoint];
    }
    if (Number.isInteger(fromPosition) && Number.isInteger(toPosition)) {
      const min = Math.min(fromPosition, toPosition);
      const max = Math.max(fromPosition, toPosition);
      const points = boardPoints.slice(min - 1, max);
      return fromPosition > toPosition ? points.reverse() : points;
    }
    const fromPoint = pointForPosition(fromPosition);
    const toPoint = pointForPosition(toPosition);
    return fromPoint && toPoint ? [fromPoint, toPoint] : [];
  }

  function buildMovementPath(previousGame, nextGame, prisonerId) {
    const previousPrisoner = previousGame?.prisoners?.find(
      (prisoner) => prisoner.id === prisonerId
    );
    const nextPrisoner = nextGame?.prisoners?.find(
      (prisoner) => prisoner.id === prisonerId
    );
    const owner = previousGame?.players?.find(
      (player) => player.user_id === previousPrisoner?.owner_user_id
    );
    if (!previousPrisoner || !nextPrisoner || !owner) {
      return null;
    }

    const points = routePointsBetween(previousPrisoner.position, nextPrisoner.position)
      .filter(Boolean);
    if (points.length < 2) {
      return null;
    }

    return {
      path: points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" "),
      teamColor: teamColors[owner.team_color]
    };
  }

  function didOwnedPrisonerMove(previousGame, nextGame, prisonerId) {
    const previousPrisoner = previousGame?.prisoners?.find(
      (prisoner) => prisoner.id === prisonerId
    );
    const nextPrisoner = nextGame?.prisoners?.find(
      (prisoner) => prisoner.id === prisonerId
    );
    return Boolean(
      previousPrisoner &&
      nextPrisoner &&
      previousPrisoner.owner_user_id === previousGame.current_user_id &&
      previousPrisoner.position !== nextPrisoner.position
    );
  }

  function didPrisonerEscape(previousGame, nextGame, prisonerId) {
    const previousPrisoner = previousGame?.prisoners?.find(
      (prisoner) => prisoner.id === prisonerId
    );
    const nextPrisoner = nextGame?.prisoners?.find(
      (prisoner) => prisoner.id === prisonerId
    );
    return Boolean(
      previousPrisoner &&
      nextPrisoner &&
      previousPrisoner.position !== "exit" &&
      nextPrisoner.position === "exit"
    );
  }

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

      {actionNotice && (
        <aside className="game-action-toast" role="status" aria-live="polite">
          <p>{actionNotice.message}</p>
          <button
            type="button"
            aria-label="Закрити повідомлення"
            onClick={() => setActionNotice(null)}
          >
            ×
          </button>
        </aside>
      )}

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
            <div className="roster-title-row">
              <h2>{game.lobby_name}</h2>
              <time className="roster-stopwatch" dateTime={`PT${elapsedSeconds}S`}>
                {elapsedTime}
              </time>
            </div>
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
                      {player.finish_order && (
                        <b className="finish-order-badge">#{player.finish_order}</b>
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

        <section
          className={`game-table-shell ${isRosterOpen ? "roster-open" : ""}`}
          aria-label={t("gamePage.table")}
        >
          <div className="opponent-seat-column" aria-label={t("gamePage.players")}>
            {Array.from({ length: 4 }).map((_, index) => {
              const player = opponents[index];
              if (!player) {
                return (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={`empty-opponent-${index}`}
                    className="table-player-seat seat-left-player empty"
                    aria-hidden="true"
                  >
                    <Users size={22} strokeWidth={1.8} />
                    <span>—</span>
                  </div>
                );
              }
              return (
                <PlayerSeat
                  key={player.user_id}
                  player={player}
                  seatClass="seat-left-player"
                  isCurrent={currentTurnPlayer?.user_id === player.user_id}
                />
              );
            })}
          </div>
          {me && (
            <PlayerSeat
              player={me}
              seatClass="seat-bottom-center"
              isCurrent={currentTurnPlayer?.user_id === me.user_id}
              handCards={visibleMyHandCards}
              isSelf
              canAct={canUseActions && Boolean(selectedPrisoner)}
              onCardClick={handleCardClick}
              onCardHover={handleCardHover}
              onCardLeave={handleCardLeave}
              language={language}
            />
          )}
          {isMyTurn && (
            <aside className="turn-controls" aria-label="Turn controls">
              <div className="turn-counter">
                <i className="turn-pulse" />
                <strong>{actionsTaken}/{actionsPerTurn}</strong>
              </div>
              <button
                type="button"
                onClick={handleEndTurn}
                disabled={!canUseActions}
              >
                Завершити хід
              </button>
            </aside>
          )}
          <div className="game-table-perspective">
            <div
              className="game-table"
              ref={boardRef}
              style={{
                "--board-grid-step-x": `${boardLayout.stepX}${boardPointUnit}`,
                "--board-grid-step-y": `${boardLayout.stepY}${boardPointUnit}`,
                "--board-grid-offset-x": `${
                  boardLayout.centerX - boardMetrics.tileSize / 2
                }${boardPointUnit}`,
                "--board-grid-offset-y": `${
                  boardLayout.centerY - boardMetrics.tileSize / 2
                }${boardPointUnit}`
              }}
              onClick={handleBoardClick}
            >
              {sparkBurst && (
                <span
                  className="spark-burst"
                  style={{ left: sparkBurst.x, top: sparkBurst.y }}
                  aria-hidden="true"
                >
                  {sparkBurst.particles.map((particle) => (
                    <i
                      key={particle.id}
                      style={{
                        "--spark-x": `${particle.dx}px`,
                        "--spark-y": `${particle.dy}px`,
                        "--spark-delay": `${particle.delay}ms`
                      }}
                    />
                  ))}
                </span>
              )}
              <svg
                className="tunnel-lines"
                viewBox={
                  boardPointUnit === "px"
                    ? `0 0 ${boardMetrics.width} ${boardMetrics.height}`
                    : "0 0 100 100"
                }
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline points={tunnelPathPoints} />
              </svg>
              {movingPrisoner && (
                <svg
                  className="movement-layer"
                  viewBox={
                    boardPointUnit === "px"
                      ? `0 0 ${boardMetrics.width} ${boardMetrics.height}`
                      : "0 0 100 100"
                  }
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <circle
                    className="moving-prisoner-dot"
                    r={boardPointUnit === "px" ? 11 : 1.55}
                    fill={movingPrisoner.teamColor}
                  >
                    <animateMotion
                      dur="650ms"
                      fill="freeze"
                      path={movingPrisoner.path}
                    />
                  </circle>
                </svg>
              )}

              <div className="start-hatch">
                <span>{t("gamePage.start")}</span>
                <button
                  type="button"
                  className="start-return-button"
                  data-audio-scope="board"
                  aria-label={t("gamePage.returnStart")}
                  disabled={!canUseActions || !selectedPrisoner}
                  onClick={handleStartReturn}
                />
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
                      const playerId = String(player.user_id);
                      const startPrisoner = startPrisonerByPlayer.get(playerId);
                      const prisonersLeft = startCountByPlayer.get(playerId) || 0;
                      if (!startPrisoner || prisonersLeft === 0) {
                        return null;
                      }
                      const canSelect =
                        canUseActions &&
                        player.user_id === game.current_user_id &&
                        !isActionPending;

                      return (
                        <button
                          type="button"
                          key={id}
                          className={`prisoner-token ${
                            selectedPrisoner === startPrisoner.id ? "selected" : ""
                          }`}
                          disabled={!canSelect}
                          data-audio-scope="unit"
                          style={{
                            "--team-color": teamColors[player.team_color],
                            "--pawn-mask": `url("${prisonerPawnImage}")`,
                            left: `${slotX}%`,
                            top: `${slotY}%`,
                            zIndex: 20 + playerIndex
                          }}
                          title={`${player.nickname}: ${prisonersLeft}`}
                          aria-pressed={selectedPrisoner === startPrisoner.id}
                          onClick={() => selectPrisoner(startPrisoner.id)}
                        >
                          <span className="prisoner-token-shape" aria-hidden="true" />
                          <span className="prisoner-count-badge">{prisonersLeft}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <button
                type="button"
                className="deck-stack"
                aria-label={language === "uk" ? "Колода" : "Deck"}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeckTiltCount((count) => count + 1);
                }}
              >
                <img src={cardBackImage} alt="" />
                <img src={cardBackImage} alt="" />
                <img key={deckTiltCount} className="deck-top-card" src={cardBackImage} alt="" />
              </button>

              <div
                className="tunnel-tile exit-gate"
                role="img"
                aria-label={t("gamePage.exit")}
                style={{
                  left: `${exitTilePoint.x}${boardPointUnit}`,
                  top: `${exitTilePoint.y}${boardPointUnit}`
                }}
              >
                <span className="exit-label">{t("gamePage.exit")}</span>
                <span className="item-popover" role="tooltip">
                  <strong>{t("gamePage.exit")}</strong>
                </span>
                <div className="exit-rescued-stack" aria-label={t("gamePage.rescuedPrisoners")}>
                  {rescuedPlayers.map((player, index) => (
                    <span
                      key={player.user_id}
                      className="exit-rescued-token"
                      style={{
                        "--team-color": teamColors[player.team_color],
                        "--pawn-mask": `url("${prisonerPawnImage}")`,
                        "--rescued-index": index
                      }}
                      title={`${player.nickname}: ${player.escaped_prisoners}`}
                    >
                      <span className="prisoner-token-shape" aria-hidden="true" />
                      <strong>{player.escaped_prisoners}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {game.route_tiles.map((tile, index) => {
                const point = boardPoints[index];
                const item = itemMap.get(tile.item_id);
                const tilePrisoners = prisonersByTile.get(tile.index) || [];
                const hasOccupants = tilePrisoners.length > 0;
                return (
                  <button
                    type="button"
                    key={`${tile.index}-${tile.item_id}`}
                    className={`tunnel-tile ${
                      hasOccupants ? "occupied" : ""
                    } ${hoveredCardId === tile.item_id ? "card-match" : ""}`}
                    data-audio-scope="board"
                    style={{
                      left: `${point.x}${boardPointUnit}`,
                      top: `${point.y}${boardPointUnit}`
                    }}
                    aria-label={
                      item
                        ? `${language === "uk" ? item.nameUk : item.nameEn}, ${
                            language === "uk" ? "тайл" : "tile"
                          } ${tile.index}`
                        : tile.item_id
                    }
                    onClick={() => handleTileClick(tile.index)}
                    disabled={!canUseActions || !selectedPrisoner}
                  >
                    <span className="tile-index">{tile.index}</span>
                    {item && <img src={item.itemImage} alt="" />}
                    <ItemPopover
                      item={item}
                      language={language}
                      kind="tile"
                      above={
                        point.y >
                        (boardPointUnit === "px" ? boardMetrics.height * 0.64 : 64)
                      }
                    />
                  </button>
                );
              })}
              {[...(game.prisoners || [])]
                .filter((prisoner) => Number.isInteger(prisoner.position))
                .map((prisoner) => {
                  const point = boardPoints[prisoner.position - 1];
                  const owner = game.players.find(
                    (player) => player.user_id === prisoner.owner_user_id
                  );
                  if (!point || !owner) {
                    return null;
                  }
                  const tilePrisoners = prisonersByTile.get(prisoner.position) || [];
                  const stackIndex = tilePrisoners.findIndex((item) => item.id === prisoner.id);
                  const canSelect =
                    canUseActions &&
                    prisoner.owner_user_id === game.current_user_id &&
                    !isActionPending;

                  return (
                    <button
                      type="button"
                      key={prisoner.id}
                      className={`prisoner-token board-prisoner ${
                        selectedPrisoner === prisoner.id ? "selected" : ""
                      }`}
                      disabled={!canSelect}
                      data-audio-scope="unit"
                      style={{
                        "--team-color": teamColors[owner.team_color],
                        "--pawn-mask": `url("${prisonerPawnImage}")`,
                        left: `calc(${point.x}${boardPointUnit} + ${
                          (stackIndex - 1) * 10
                        }px)`,
                        top: `calc(${point.y}${boardPointUnit} + ${
                          stackIndex * 2
                        }px)`,
                        zIndex: 140 + stackIndex
                      }}
                      title={`${owner.nickname}: prisoner ${prisoner.index}`}
                      aria-pressed={selectedPrisoner === prisoner.id}
                      onClick={() => selectPrisoner(prisoner.id)}
                    >
                      <span className="prisoner-token-shape" aria-hidden="true" />
                    </button>
                  );
                })}
            </div>
          </div>
        </section>
      </section>
      {playedCard && (
        <div className="played-card-overlay" aria-hidden="true">
          <img src={playedCard.cardImage} alt="" />
        </div>
      )}
      {winningPlayers.length > 0 && (
        <aside className="game-victory-banner" aria-live="polite">
          <p>{t("gamePage.victoryKicker")}</p>
          <strong>
            {t("gamePage.victoryText", {
              nickname: winningPlayers.map((player) => player.nickname).join(", ")
            })}
          </strong>
        </aside>
      )}
      {shouldShowResultModal && (
        <div className="game-result-backdrop" role="presentation">
          <section
            className={`game-result-modal ${resultKind}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-result-title"
          >
            <p className="profile-kicker">
              {resultKind === "victory"
                ? t("gamePage.resultVictoryKicker")
                : t("gamePage.resultLossKicker")}
            </p>
            <h2 id="game-result-title">
              {resultKind === "victory"
                ? t("gamePage.resultVictoryTitle")
                : resultKind === "finished"
                  ? t("gamePage.resultFinishedTitle", { order: me?.finish_order })
                  : t("gamePage.resultLossTitle")}
            </h2>
            <p>
              {resultKind === "victory"
                ? t("gamePage.resultVictoryText")
                : resultKind === "finished"
                  ? t("gamePage.resultFinishedText")
                  : t("gamePage.resultLossText", {
                    nickname: firstFinisher?.nickname || ""
                  })}
            </p>
            <div className="game-result-actions">
              <button type="button" onClick={leaveCurrentGame}>
                {t("gamePage.leave")}
              </button>
              <button type="button" className="secondary" onClick={continueAsObserver}>
                {t("gamePage.continueGame")}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
