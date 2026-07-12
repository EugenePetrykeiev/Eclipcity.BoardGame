import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "eclipcity_language";
const DEFAULT_LANGUAGE = "uk";

const translations = {
  uk: {
    "common.close": "Закрити",
    "common.cancel": "Скасувати",
    "common.loadingProfile": "Завантаження профілю...",
    "common.backHome": "Повернутися на головну",
    "common.playersCount": "{current} з {max} гравців у лоббі",
    "common.clipboardError": "Не вдалося скопіювати ID лоббі.",
    "profile.runnerProfile": "Runner profile",
    "profile.unknownUser": "Невідомий користувач",
    "profile.matchesPlayed": "матчів зіграно",
    "profile.wins": "перемог",
    "profile.actions": "Дії користувача",
    "profile.stats": "Статистика гравця",
    "profile.userData": "Дані користувача",
    "profile.pageLabel": "Профіль користувача Eclipcity",
    "profile.mockKicker": "Profile feed",
    "profile.mockText":
      "Тут буде персональний профіль гравця: відео, історія матчів, досягнення та публічна інформація.",
    "actions.startGame": "Почати гру",
    "actions.settings": "Налаштування",
    "actions.soundOff": "Вимкнути звуки",
    "actions.soundOn": "Увімкнути звуки",
    "actions.soundOnToast": "Звуки увімкнено.",
    "actions.soundOffToast": "Звуки вимкнено.",
    "actions.language": "Мова інтерфейсу",
    "actions.settingsToast":
      "Викликано дію: налаштування. Тут будуть профіль, звук, мова та системні параметри.",
    "start.created": "Лоббі створено",
    "start.joined": "Приєднався до лоббі",
    "start.local": "Створення локальної гри",
    "start.choose": "Обери сценарій",
    "start.creating": "Створення лоббі",
    "start.joining": "Приєднання до лоббі",
    "game.setup": "Game setup",
    "game.chooseMode": "Обери режим",
    "game.create": "Створити гру",
    "game.join": "Приєднатися до гри",
    "game.local": "Грати локально",
    "game.localToast": "Створення локальної гри буде додано далі.",
    "gamePage.label": "Ігрова сесія Eclipcity",
    "gamePage.kicker": "Game session",
    "gamePage.lobbyCode": "Лоббі {code}",
    "gamePage.profile": "Профіль",
    "gamePage.leave": "Покинути гру",
    "gamePage.table": "Ігровий стіл і тунель",
    "gamePage.players": "Гравці",
    "gamePage.me": "я",
    "gamePage.start": "Старт",
    "gamePage.startPrisoners": "В'язні на старті",
    "gamePage.exit": "Вихід",
    "gamePage.cardsCount": "{count} карт",
    "gamePage.host": "хост",
    "gamePage.loading": "Завантаження ігрової сесії...",
    "gamePage.invalidRoute": "Некоректний route гри. Очікується /game/UUID.",
    "gamePage.loadError": "Не вдалося завантажити гру.",
    "gamePage.connectionLost": "З'єднання з грою тимчасово втрачено.",
    "gamePage.leaveError": "Не вдалося покинути гру.",
    "gamePage.startError": "Не вдалося запустити гру.",
    "gamePage.accessDenied": "Game access",
    "gamePage.unavailable": "Гра недоступна",
    "gamePage.reconnectTimer": "Reconnect: {seconds} сек.",
    "gamePage.removed": "Гравець вибув.",
    "gamePage.reconnectKicker": "Active game",
    "gamePage.reconnectTitle": "Ти вже в грі",
    "gamePage.reconnectText":
      "У тебе є активна ігрова сесія. Перепідключися до неї, щоб не втратити місце в команді.",
    "gamePage.reconnect": "Перепідключитися",
    "stage.access": "Eclipcity access",
    "stage.title": "Лоббі та ігровий стіл з'являться тут",
    "stage.text":
      "Це персональна зона користувача після авторизації. Ліворуч залишаються профіль, статистика та основні дії, а центральна зона зарезервована під кімнати, локальну гру та майбутній стіл.",
    "lobby.setup": "Lobby setup",
    "lobby.createTitle": "Створити лоббі",
    "lobby.playersAmount": "Кількість гравців",
    "lobby.name": "Назва лоббі",
    "lobby.public": "Публічне лоббі",
    "lobby.private": "Приватне лоббі",
    "lobby.defaultNameHint":
      "Назву можна не заповнювати, тоді буде використано Untitled lobby.",
    "lobby.nameMin": "Назва має містити мінімум 3 символи або лишитися порожньою.",
    "lobby.nameMax": "Назва має містити максимум 15 символів.",
    "lobby.nameChars": "Дозволені літери, цифри, пробіли та !@#$%^&*(),./|\\?`~.",
    "lobby.create": "Створити",
    "lobby.createdToast": "Лоббі \"{name}\" створено. ID: {code}.",
    "lobby.createError": "Не вдалося створити лоббі.",
    "lobby.publicKicker": "Public lobby",
    "lobby.privateKicker": "Private lobby",
    "lobby.copyTitle": "Скопіювати ID лоббі",
    "lobby.copyToast": "ID лоббі {code} скопійовано.",
    "lobby.nickname": "Нікнейм",
    "lobby.team": "Команда",
    "lobby.host": "Хост",
    "lobby.controls": "Керування гравцем",
    "lobby.hostAria": "Хост лоббі",
    "lobby.notHostAria": "Не хост",
    "lobby.kick": "Виключити {nickname}",
    "lobby.kickedToast": "Гравця виключено з лоббі.",
    "lobby.kickError": "Не вдалося виключити гравця.",
    "lobby.events": "Події лоббі",
    "lobby.chatPlaceholder": "Чат буде доступний пізніше",
    "lobby.start": "Старт",
    "lobby.startToast": "Старт лоббі буде додано далі.",
    "lobby.leave": "Покинути лоббі",
    "lobby.leftToast": "Ти покинув лоббі.",
    "lobby.leaveError": "Не вдалося покинути лоббі.",
    "lobby.noLongerMember": "Ти більше не в цьому лоббі.",
    "lobby.teamError": "Не вдалося змінити команду.",
    "lobby.minimizedLabel": "Згорнуте лоббі",
    "lobby.restore": "Розгорнути лоббі",
    "lobby.active": "Active lobby",
    "lobby.minimizedToast": "Лоббі згорнуто. Його стан лишається справа внизу.",
    "join.kicker": "Public lobbies",
    "join.title": "Приєднатися до лоббі",
    "join.byCodeLabel": "Приєднання за кодом лоббі",
    "join.code": "Код лоббі",
    "join.byCode": "Приєднатися за кодом",
    "join.listLabel": "Список публічних лоббі",
    "join.nameHeader": "Назва лоббі",
    "join.idHeader": "ID лоббі",
    "join.playersHeader": "Гравці",
    "join.loading": "Завантаження публічних лоббі...",
    "join.error": "Не вдалося завантажити список.",
    "join.empty": "Публічних лоббі поки немає.",
    "join.submit": "Приєднатися до лоббі",
    "join.refresh": "Оновити список",
    "join.refreshError": "Не вдалося завантажити публічні лоббі.",
    "join.codeLength": "Код лоббі має містити 5 символів.",
    "join.success": "Ти приєднався до лоббі {code}.",
    "join.errorToast": "Не вдалося приєднатися до лоббі.",
    "route.invalid": "Некоректний route. Очікується /user/UUID або /lobby/ID.",
    "route.profileError": "Не вдалося завантажити профіль.",
    "modal.conflict": "Lobby conflict",
    "modal.leaveTitle": "Вийти з попереднього лоббі?",
    "modal.leave": "Вийти з лоббі",
    "modal.currentClosedJoin": "Поточне лоббі закрито. Обери нове або введи код.",
    "modal.currentClosedLocal": "Поточне лоббі закрито. Локальний режим буде додано далі."
  },
  en: {
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.loadingProfile": "Loading profile...",
    "common.backHome": "Back to home",
    "common.playersCount": "{current} of {max} players in lobby",
    "common.clipboardError": "Could not copy lobby ID.",
    "profile.runnerProfile": "Runner profile",
    "profile.unknownUser": "Unknown user",
    "profile.matchesPlayed": "matches played",
    "profile.wins": "wins",
    "profile.actions": "User actions",
    "profile.stats": "Player statistics",
    "profile.userData": "User data",
    "profile.pageLabel": "Eclipcity user profile",
    "profile.mockKicker": "Profile feed",
    "profile.mockText":
      "This temporary profile panel will later show video, match history, achievements, and public player information.",
    "actions.startGame": "Start game",
    "actions.settings": "Settings",
    "actions.soundOff": "Mute sound",
    "actions.soundOn": "Enable sound",
    "actions.soundOnToast": "Sound enabled.",
    "actions.soundOffToast": "Sound muted.",
    "actions.language": "Interface language",
    "actions.settingsToast":
      "Settings action triggered. Profile, sound, language, and system options will live here.",
    "start.created": "Lobby created",
    "start.joined": "Joined lobby",
    "start.local": "Creating local game",
    "start.choose": "Choose mode",
    "start.creating": "Creating lobby",
    "start.joining": "Joining lobby",
    "game.setup": "Game setup",
    "game.chooseMode": "Choose mode",
    "game.create": "Create game",
    "game.join": "Join game",
    "game.local": "Play locally",
    "game.localToast": "Local game creation will be added later.",
    "gamePage.label": "Eclipcity game session",
    "gamePage.kicker": "Game session",
    "gamePage.lobbyCode": "Lobby {code}",
    "gamePage.profile": "Profile",
    "gamePage.leave": "Leave game",
    "gamePage.table": "Game table and tunnel",
    "gamePage.players": "Players",
    "gamePage.me": "me",
    "gamePage.start": "Start",
    "gamePage.startPrisoners": "Prisoners at start",
    "gamePage.exit": "Exit",
    "gamePage.cardsCount": "{count} cards",
    "gamePage.host": "host",
    "gamePage.loading": "Loading game session...",
    "gamePage.invalidRoute": "Invalid game route. Expected /game/UUID.",
    "gamePage.loadError": "Could not load the game.",
    "gamePage.connectionLost": "Game connection temporarily lost.",
    "gamePage.leaveError": "Could not leave the game.",
    "gamePage.startError": "Could not start the game.",
    "gamePage.accessDenied": "Game access",
    "gamePage.unavailable": "Game unavailable",
    "gamePage.reconnectTimer": "Reconnect: {seconds}s.",
    "gamePage.removed": "Player removed.",
    "gamePage.reconnectKicker": "Active game",
    "gamePage.reconnectTitle": "You are already in a game",
    "gamePage.reconnectText":
      "You have an active game session. Reconnect to keep your place on the team.",
    "gamePage.reconnect": "Reconnect",
    "stage.access": "Eclipcity access",
    "stage.title": "Lobby and game table will appear here",
    "stage.text":
      "This is the authenticated player area. The left side keeps profile, statistics, and actions, while the main area is reserved for rooms, local play, and the future table.",
    "lobby.setup": "Lobby setup",
    "lobby.createTitle": "Create lobby",
    "lobby.playersAmount": "Player count",
    "lobby.name": "Lobby name",
    "lobby.public": "Public lobby",
    "lobby.private": "Private lobby",
    "lobby.defaultNameHint":
      "The name can stay empty. Untitled lobby will be used by default.",
    "lobby.nameMin": "Name must contain at least 3 characters or stay empty.",
    "lobby.nameMax": "Name must contain at most 15 characters.",
    "lobby.nameChars": "Letters, digits, spaces, and !@#$%^&*(),./|\\?`~ are allowed.",
    "lobby.create": "Create",
    "lobby.createdToast": "Lobby \"{name}\" created. ID: {code}.",
    "lobby.createError": "Could not create lobby.",
    "lobby.publicKicker": "Public lobby",
    "lobby.privateKicker": "Private lobby",
    "lobby.copyTitle": "Copy lobby ID",
    "lobby.copyToast": "Lobby ID {code} copied.",
    "lobby.nickname": "Nickname",
    "lobby.team": "Team",
    "lobby.host": "Host",
    "lobby.controls": "Player controls",
    "lobby.hostAria": "Lobby host",
    "lobby.notHostAria": "Not host",
    "lobby.kick": "Kick {nickname}",
    "lobby.kickedToast": "Player removed from lobby.",
    "lobby.kickError": "Could not remove player.",
    "lobby.events": "Lobby events",
    "lobby.chatPlaceholder": "Chat will be available later",
    "lobby.start": "Start",
    "lobby.startToast": "Lobby start will be added later.",
    "lobby.leave": "Leave lobby",
    "lobby.leftToast": "You left the lobby.",
    "lobby.leaveError": "Could not leave lobby.",
    "lobby.noLongerMember": "You are no longer in this lobby.",
    "lobby.teamError": "Could not change team.",
    "lobby.minimizedLabel": "Minimized lobby",
    "lobby.restore": "Restore lobby",
    "lobby.active": "Active lobby",
    "lobby.minimizedToast": "Lobby minimized. Its state stays in the bottom-right.",
    "join.kicker": "Public lobbies",
    "join.title": "Join lobby",
    "join.byCodeLabel": "Join by lobby code",
    "join.code": "Lobby code",
    "join.byCode": "Join by code",
    "join.listLabel": "Public lobby list",
    "join.nameHeader": "Lobby name",
    "join.idHeader": "Lobby ID",
    "join.playersHeader": "Players",
    "join.loading": "Loading public lobbies...",
    "join.error": "Could not load the list.",
    "join.empty": "There are no public lobbies yet.",
    "join.submit": "Join lobby",
    "join.refresh": "Refresh list",
    "join.refreshError": "Could not load public lobbies.",
    "join.codeLength": "Lobby code must contain 5 characters.",
    "join.success": "You joined lobby {code}.",
    "join.errorToast": "Could not join lobby.",
    "route.invalid": "Invalid route. Expected /user/UUID or /lobby/ID.",
    "route.profileError": "Could not load profile.",
    "modal.conflict": "Lobby conflict",
    "modal.leaveTitle": "Leave previous lobby?",
    "modal.leave": "Leave lobby",
    "modal.currentClosedJoin": "Current lobby closed. Choose a new one or enter a code.",
    "modal.currentClosedLocal": "Current lobby closed. Local mode will be added later."
  }
};

const I18nContext = createContext(null);

function getInitialLanguage() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  const storedLanguage = window.localStorage.getItem(STORAGE_KEY);
  return translations[storedLanguage] ? storedLanguage : DEFAULT_LANGUAGE;
}

function interpolate(value, params = {}) {
  return Object.entries(params).reduce(
    (current, [key, replacement]) =>
      current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(nextLanguage) {
    if (!translations[nextLanguage]) {
      return;
    }
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    document.documentElement.lang = nextLanguage;
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t(key, params) {
        const translation = translations[language][key] ?? translations.uk[key] ?? key;
        return interpolate(translation, params);
      }
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
}
