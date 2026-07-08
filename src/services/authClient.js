const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL не налаштовано для підключення backend.");
  }
  return API_BASE_URL;
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
    throw new Error(payload.detail || payload.message || "Auth request failed.");
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
    throw new Error(payload.detail || payload.message || "User request failed.");
  }

  return payload;
}
