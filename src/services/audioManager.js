import battleMusicUrl from "../assets/music/background/battle.mp3";
import menuMusicUrl from "../assets/music/background/menu.mp3";
import clickCardUrl from "../assets/music/cards/click_card.wav";
import drawCardUrl from "../assets/music/cards/draw_card.wav";
import playCardUrl from "../assets/music/cards/play_card.wav";
import selectCardUrl from "../assets/music/cards/select_card.wav";
import yourTurnUrl from "../assets/music/game/your_turn.wav";
import clickBoardUrl from "../assets/music/ui/click_board.wav";
import hitButtonUrl from "../assets/music/ui/hit_button.wav";
import hoverButtonUrl from "../assets/music/ui/hover_button.wav";
import moveUnitUrl from "../assets/music/units/move.wav";
import pickUnitUrl from "../assets/music/units/pick.wav";

export const MAX_AUDIO_VOLUME = 0.5;

const ENABLED_COOKIE = "eclipcity_sound_enabled";
const VOLUME_COOKIE = "eclipcity_sound_volume";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const backgroundUrls = {
  battle: battleMusicUrl,
  menu: menuMusicUrl
};

const effectUrls = {
  clickBoard: clickBoardUrl,
  clickCard: clickCardUrl,
  drawCard: drawCardUrl,
  hitButton: hitButtonUrl,
  hoverButton: hoverButtonUrl,
  moveUnit: moveUnitUrl,
  pickUnit: pickUnitUrl,
  playCard: playCardUrl,
  selectCard: selectCardUrl,
  yourTurn: yourTurnUrl
};

function readCookie(name) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function writeCookie(name, value) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clampVolume(value) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return MAX_AUDIO_VOLUME;
  }
  return Math.min(MAX_AUDIO_VOLUME, Math.max(0, parsedValue));
}

function readPreferences() {
  return {
    enabled: readCookie(ENABLED_COOKIE) !== "false",
    volume: clampVolume(readCookie(VOLUME_COOKIE) ?? MAX_AUDIO_VOLUME)
  };
}

class AudioManager {
  constructor() {
    this.preferences = readPreferences();
    this.backgroundTracks = new Map();
    this.effectTracks = new Map();
    this.activeBackground = null;
    this.activeEffect = null;
    this.scene = null;
    this.listeners = new Set();
    this.unlockListenersAttached = false;
  }

  getPreferences() {
    return { ...this.preferences };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setEnabled(enabled) {
    this.updatePreferences({ enabled: Boolean(enabled) });
  }

  setVolume(volume) {
    this.updatePreferences({ volume: clampVolume(volume) });
  }

  updatePreferences(nextPreferences) {
    const previousPreferences = this.preferences;
    this.preferences = {
      enabled: nextPreferences.enabled ?? previousPreferences.enabled,
      volume:
        nextPreferences.volume === undefined
          ? previousPreferences.volume
          : clampVolume(nextPreferences.volume)
    };

    writeCookie(ENABLED_COOKIE, String(this.preferences.enabled));
    writeCookie(VOLUME_COOKIE, String(this.preferences.volume));
    this.applyPreferences();
    this.listeners.forEach((listener) => listener(this.getPreferences()));
  }

  setScene(scene) {
    if (!backgroundUrls[scene]) {
      return;
    }

    this.scene = scene;
    const nextTrack = this.getTrack(this.backgroundTracks, backgroundUrls[scene], true);

    if (this.activeBackground && this.activeBackground !== nextTrack) {
      this.activeBackground.pause();
      this.activeBackground.currentTime = 0;
    }

    this.activeBackground = nextTrack;
    this.applyPreferences();
  }

  playEffect(effectName) {
    const url = effectUrls[effectName];
    if (
      !url ||
      !this.preferences.enabled ||
      this.preferences.volume <= 0 ||
      typeof Audio === "undefined"
    ) {
      return;
    }

    const nextTrack = this.getTrack(this.effectTracks, url, false);
    if (this.activeEffect) {
      this.activeEffect.pause();
      this.activeEffect.currentTime = 0;
    }

    this.activeEffect = nextTrack;
    nextTrack.volume = this.preferences.volume;
    nextTrack.currentTime = 0;
    nextTrack.onended = () => {
      if (this.activeEffect === nextTrack) {
        this.activeEffect = null;
      }
    };
    this.play(nextTrack);
  }

  getTrack(collection, url, loop) {
    if (collection.has(url)) {
      return collection.get(url);
    }
    if (typeof Audio === "undefined") {
      return null;
    }

    const track = new Audio();
    track.loop = loop;
    track.preload = loop ? "metadata" : "auto";
    track.src = url;
    collection.set(url, track);
    return track;
  }

  applyPreferences() {
    const shouldPlay =
      this.preferences.enabled && this.preferences.volume > 0;

    if (this.activeBackground) {
      this.activeBackground.volume = this.preferences.volume;
      if (shouldPlay) {
        this.play(this.activeBackground);
      } else {
        this.activeBackground.pause();
      }
    }

    if (this.activeEffect) {
      this.activeEffect.volume = this.preferences.volume;
      if (!shouldPlay) {
        this.activeEffect.pause();
        this.activeEffect.currentTime = 0;
        this.activeEffect = null;
      }
    }
  }

  play(track) {
    if (!track) {
      return;
    }

    const playResult = track.play();
    if (playResult?.catch) {
      playResult.catch(() => this.attachUnlockListeners());
    }
  }

  attachUnlockListeners() {
    if (this.unlockListenersAttached || typeof window === "undefined") {
      return;
    }

    this.unlockListenersAttached = true;
    const unlock = () => {
      this.unlockListenersAttached = false;
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      if (
        this.activeBackground &&
        this.preferences.enabled &&
        this.preferences.volume > 0
      ) {
        this.play(this.activeBackground);
      }
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
  }
}

export const audioManager = new AudioManager();
