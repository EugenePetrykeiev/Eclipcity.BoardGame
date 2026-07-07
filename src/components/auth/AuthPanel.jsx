import { useMemo, useState } from "react";
import { startGoogleOAuth, submitAuthForm } from "../../services/authClient.js";

const initialValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: ""
};

function validate(mode, values) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernamePattern = /^[a-zA-Z0-9_-]{3,24}$/;

  if (mode === "register" && !usernamePattern.test(values.username.trim())) {
    errors.username = "3-24 символи: латиниця, цифри, _ або -.";
  }

  if (!emailPattern.test(values.email.trim())) {
    errors.email = "Введи коректний email.";
  }

  if (values.password.length < 8) {
    errors.password = "Мінімум 8 символів.";
  }

  if (mode === "register" && values.confirmPassword !== values.password) {
    errors.confirmPassword = "Паролі мають збігатися.";
  }

  return errors;
}

export default function AuthPanel() {
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = mode === "login" ? "Вхід до міста" : "Новий втікач";
  const submitLabel = mode === "login" ? "Увійти" : "Зареєструватися";

  const helperText = useMemo(() => {
    if (mode === "login") {
      return "Увійди, щоб перейти до майбутньої зони кімнат і лобі.";
    }

    return "Створи профіль для мультиплеєрної гри та майбутніх кімнат.";
  }, [mode]);

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
    const nextErrors = validate(mode, values);
    setErrors(nextErrors);
    setStatus(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitAuthForm(mode, values);
      setStatus({
        type: "success",
        message: result.message
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Не вдалося обробити форму."
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
        message: "Переходимо до Google OAuth..."
      });
      startGoogleOAuth(mode);
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Google OAuth тимчасово недоступний."
      });
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="auth-panel" aria-label="Авторизація Eclipcity">
      <div className="panel-heading">
        <p className="panel-kicker">Access terminal</p>
        <h2>{title}</h2>
        <p>{helperText}</p>
      </div>

      <div className="auth-tabs" role="tablist" aria-label="Режим авторизації">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "active" : ""}
          onClick={() => switchMode("login")}
        >
          Login
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? "active" : ""}
          onClick={() => switchMode("register")}
        >
          Register
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {mode === "register" && (
          <label className="field">
            <span>Username</span>
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
          <span>Email</span>
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
          <span>Password</span>
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
            <span>Confirm password</span>
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
          {isSubmitting ? "Обробка..." : submitLabel}
        </button>
      </form>

      <div className="auth-divider">
        <span>або</span>
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
