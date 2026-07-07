const PREVIEW_SESSION_KEY = "eclipcity.preview.auth";

function delay(ms = 450) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function persistPreviewSession(payload) {
  window.localStorage.setItem(
    PREVIEW_SESSION_KEY,
    JSON.stringify({
      ...payload,
      createdAt: new Date().toISOString()
    })
  );
}

export async function submitAuthForm(mode, values) {
  await delay();

  const profile =
    mode === "register"
      ? values.username.trim()
      : values.email.trim().split("@")[0];

  persistPreviewSession({
    mode,
    provider: "email",
    profile,
    email: values.email.trim()
  });

  return {
    ok: true,
    message:
      mode === "register"
        ? "Профіль створено локально для preview. Далі буде підключення FastAPI."
        : "Вхід підтверджено локально для preview. Ігрова зона буде наступним екраном."
  };
}

export async function startGoogleOAuth(mode) {
  await delay(350);

  persistPreviewSession({
    mode,
    provider: "google",
    profile: "google-player"
  });

  return {
    ok: true,
    message: "Google OAuth підготовлено як preview-заглушку до підключення бекенду."
  };
}
