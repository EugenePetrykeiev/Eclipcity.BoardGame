import { useMemo, useState } from "react";
import { startGoogleOAuth, submitAuthForm } from "../../services/authClient.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const initialValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: ""
};

function validate(mode, values, t) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernamePattern = /^[a-zA-Z0-9_-]{3,24}$/;

  if (mode === "register" && !usernamePattern.test(values.username.trim())) {
    errors.username = t("auth.usernameValidation");
  }

  if (!emailPattern.test(values.email.trim())) {
    errors.email = t("auth.emailValidation");
  }

  if (values.password.length < 8) {
    errors.password = t("auth.passwordValidation");
  }

  if (mode === "register" && values.confirmPassword !== values.password) {
    errors.confirmPassword = t("auth.confirmPasswordValidation");
  }

  return errors;
}

export default function AuthPanel() {
  const { t } = useI18n();
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle");
  const submitLabel =
    mode === "login" ? t("auth.loginSubmit") : t("auth.registerSubmit");

  const helperText = useMemo(() => {
    if (mode === "login") {
      return t("auth.loginHelp");
    }

    return t("auth.registerHelp");
  }, [mode, t]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setErrors({});
    setStatus(null);
  }

  function updateValue(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(mode, values, t);
    setErrors(nextErrors);
    setStatus(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitAuthForm(mode, values);
      const emailStatus =
        result.email_delivery_status && result.email_delivery_status !== "sent"
          ? ` ${t("auth.emailStatus", { status: result.email_delivery_status })}`
          : "";
      setStatus({
        type: "success",
        message: `${result.message}${emailStatus}`
      });
      if (result.next) {
        window.setTimeout(() => {
          window.location.assign(result.next);
        }, 450);
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || t("auth.formError")
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleClick() {
    setStatus(null);
    try {
      setIsSubmitting(true);
      setStatus({
        type: "success",
        message: t("auth.googleRedirect")
      });
      startGoogleOAuth(mode);
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || t("auth.googleError")
      });
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="auth-panel" aria-label={t("auth.panelLabel")}>
      <div className="panel-heading">
        <p className="panel-kicker">Access terminal</p>
        <h2>{title}</h2>
        <p>{helperText}</p>
      </div>

      <div className="auth-tabs" role="tablist" aria-label={t("auth.modeLabel")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "active" : ""}
          onClick={() => switchMode("login")}
        >
          {t("auth.loginTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? "active" : ""}
          onClick={() => switchMode("register")}
        >
          {t("auth.registerTab")}
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {mode === "register" && (
          <label className="field">
            <span>{t("auth.username")}</span>
            <input
              name="username"
              value={values.username}
              onChange={updateValue}
              autoComplete="username"
              aria-invalid={Boolean(errors.username)}
            />
            {errors.username && <small>{errors.username}</small>}
          </label>
        )}

        <label className="field">
          <span>{t("auth.email")}</span>
          <input
            name="email"
            type="email"
            value={values.email}
            onChange={updateValue}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <small>{errors.email}</small>}
        </label>

        <label className="field">
          <span>{t("auth.password")}</span>
          <input
            name="password"
            type="password"
            value={values.password}
            onChange={updateValue}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <small>{errors.password}</small>}
        </label>

        {mode === "register" && (
          <label className="field">
            <span>{t("auth.confirmPassword")}</span>
            <input
              name="confirmPassword"
              type="password"
              value={values.confirmPassword}
              onChange={updateValue}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
            />
            {errors.confirmPassword && <small>{errors.confirmPassword}</small>}
          </label>
        )}

        {status && (
          <p className={`form-status ${status.type}`} role="status">
            {status.message}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.processing") : submitLabel}
        </button>
      </form>

      <div className="auth-divider">
        <span>{t("auth.or")}</span>
      </div>

      <button
        className="google-button"
        type="button"
        onClick={handleGoogleClick}
        disabled={isSubmitting}
      >
        <span aria-hidden="true">G</span>
        Google OAuth
      </button>
    </aside>
  );
}
