const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL не налаштовано для підключення backend.");
  }
  return API_BASE_URL;
}

function formatApiError(payload, fallback) {
  const detail = payload.detail || payload.message;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item?.msg) {
          return item.msg;
        }
        return JSON.stringify(item);
      })
      .join(" ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }

  return fallback;
}

export async function submitAuthForm(mode, values) {
  const apiBaseUrl = requireApiBaseUrl();
  const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
  const body =
    mode === "register"
      ? {
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password
        }
      : {
          email: values.email.trim(),
          password: values.password
        };

  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatApiError(payload, "Auth request failed."));
  }

  return payload;
}

export function startGoogleOAuth(mode) {
  const apiBaseUrl = requireApiBaseUrl();
  const params = new URLSearchParams({ mode });
  window.location.assign(`${apiBaseUrl}/auth/google/start?${params.toString()}`);
}

export async function getUserProfile(userId) {
  const apiBaseUrl = requireApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/users/${userId}`, {
    credentials: "include"
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatApiError(payload, "User request failed."));
  }

  return payload;
}

export async function getCurrentUser() {
  const apiBaseUrl = requireApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    credentials: "include"
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatApiError(payload, "Current user request failed."));
  }

  return payload;
}

export async function getAuthSession() {
  const apiBaseUrl = requireApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/auth/session`, {
    credentials: "include"
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatApiError(payload, "Session request failed."));
  }

  return payload;
}

async function lobbyRequest(endpoint, options = {}) {
  const apiBaseUrl = requireApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatApiError(payload, "Lobby request failed."));
  }

  return payload;
}

export function listPublicLobbies() {
  return lobbyRequest("/lobbies/public");
}

export function createLobby(values) {
  return lobbyRequest("/lobbies", {
    method: "POST",
    body: JSON.stringify(values)
  });
}

export function getLobbyDetails(code) {
  return lobbyRequest(`/lobbies/${code}`);
}

export function joinLobbyByCode(code) {
  return lobbyRequest(`/lobbies/${code}/join`, {
    method: "POST"
  });
}

export function updateLobbyPlayer(code, values) {
  return lobbyRequest(`/lobbies/${code}/players/me`, {
    method: "PATCH",
    body: JSON.stringify(values)
  });
}

export function leaveLobbyByCode(code) {
  return lobbyRequest(`/lobbies/${code}/leave`, {
    method: "POST"
  });
}

export function kickLobbyPlayer(code, userId) {
  return lobbyRequest(`/lobbies/${code}/players/${userId}`, {
    method: "DELETE"
  });
}

export function startLobbyGame(code, values = {}) {
  return lobbyRequest(`/lobbies/${code}/start-game`, {
    method: "POST",
    body: JSON.stringify(values)
  });
}

export function getActiveGame() {
  return lobbyRequest("/games/active");
}

export function getGameDetails(gameId) {
  return lobbyRequest(`/games/${gameId}`);
}

export function heartbeatGame(gameId) {
  return lobbyRequest(`/games/${gameId}/heartbeat`, {
    method: "POST"
  });
}

export function leaveGameById(gameId) {
  return lobbyRequest(`/games/${gameId}/leave`, {
    method: "POST"
  });
}

export function playGameCard(gameId, values) {
  return lobbyRequest(`/games/${gameId}/actions/play-card`, {
    method: "POST",
    body: JSON.stringify(values)
  });
}

export function moveGamePrisonerBack(gameId, values) {
  return lobbyRequest(`/games/${gameId}/actions/move-back`, {
    method: "POST",
    body: JSON.stringify(values)
  });
}

export function endGameTurn(gameId) {
  return lobbyRequest(`/games/${gameId}/actions/end-turn`, {
    method: "POST"
  });
}
