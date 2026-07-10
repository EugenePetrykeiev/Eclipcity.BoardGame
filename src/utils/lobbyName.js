export const defaultLobbyName = "Untitled lobby";

const allowedLobbySymbols = new Set([..." !@#$%^&*(),./|\\?`~"]);

export function isLetterOrDigit(character) {
  return /^[A-Za-z0-9А-Яа-яІіЇїЄєҐґ]$/u.test(character);
}

export function hasAllowedLobbyNameCharacters(value) {
  return [...value].every(
    (character) => isLetterOrDigit(character) || allowedLobbySymbols.has(character)
  );
}

export function validateLobbyName(value, messages = {}) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return { isValid: true, message: "" };
  }

  if (normalizedValue.length < 3) {
    return {
      isValid: false,
      message:
        messages.min || "Name must contain at least 3 characters or stay empty."
    };
  }

  if (normalizedValue.length > 15) {
    return {
      isValid: false,
      message: messages.max || "Name must contain at most 15 characters."
    };
  }

  if (!hasAllowedLobbyNameCharacters(normalizedValue)) {
    return {
      isValid: false,
      message: messages.chars || "Lobby name contains unsupported characters."
    };
  }

  return { isValid: true, message: "" };
}
