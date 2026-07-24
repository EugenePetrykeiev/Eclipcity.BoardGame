import battleMusicUrl from "../assets/music/background/battle.mp3";
import menuMusicUrl from "../assets/music/background/menu.mp3";
import clickCardUrl from "../assets/music/cards/click_card.wav";
import drawCardUrl from "../assets/music/cards/draw_card.wav";
import playCardUrl from "../assets/music/cards/play_card.wav";
import selectCardUrl from "../assets/music/cards/select_card.wav";
import escapeUrl from "../assets/music/game/escape.wav";
import yourTurnUrl from "../assets/music/game/your_turn.wav";
import clickBoardUrl from "../assets/music/ui/click_board.wav";
import hitButtonUrl from "../assets/music/ui/hit_button.wav";
import hoverButtonUrl from "../assets/music/ui/hover_button.wav";
import moveUnitUrl from "../assets/music/units/move.wav";
import pickUnitUrl from "../assets/music/units/pick.wav";

export const MAX_MUSIC_VOLUME = 0.1;
export const MAX_EFFECTS_VOLUME = 0.5;
export const DEFAULT_EFFECTS_VOLUME = 0.25;

const ENABLED_COOKIE = "eclipcity_sound_enabled";
const LEGACY_VOLUME_COOKIE = "eclipcity_sound_volume";
const MUSIC_VOLUME_COOKIE = "eclipcity_music_volume";
const EFFECTS_VOLUME_COOKIE = "eclipcity_effects_volume";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const backgroundUrls = {
  battle: battleMusicUrl,
  menu: menuMusicUrl
};

const effectUrls = {
  clickBoard: clickBoardUrl,
  clickCard: clickCardUrl,
  drawCard: drawCardUrl,
  escape: escapeUrl,
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

function clampVolume(value, maximum, fallback) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(0, parsedValue));
}

function readPreferences() {
  const legacyVolume = readCookie(LEGACY_VOLUME_COOKIE);
  return {
    enabled: readCookie(ENABLED_COOKIE) !== "false",
    musicVolume: clampVolume(
      readCookie(MUSIC_VOLUME_COOKIE) ?? legacyVolume,
      MAX_MUSIC_VOLUME,
      MAX_MUSIC_VOLUME
    ),
    effectsVolume: clampVolume(
      readCookie(EFFECTS_VOLUME_COOKIE),
      MAX_EFFECTS_VOLUME,
      DEFAULT_EFFECTS_VOLUME
    )
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

  setMusicVolume(volume) {
    this.updatePreferences({
      musicVolume: clampVolume(
        volume,
        MAX_MUSIC_VOLUME,
        MAX_MUSIC_VOLUME
      )
    });
  }

  setEffectsVolume(volume) {
    this.updatePreferences({
      effectsVolume: clampVolume(
        volume,
        MAX_EFFECTS_VOLUME,
        DEFAULT_EFFECTS_VOLUME
      )
    });
  }

  updatePreferences(nextPreferences) {
    const previousPreferences = this.preferences;
    this.preferences = {
      enabled: nextPreferences.enabled ?? previousPreferences.enabled,
      musicVolume:
        nextPreferences.musicVolume === undefined
          ? previousPreferences.musicVolume
          : clampVolume(
              nextPreferences.musicVolume,
              MAX_MUSIC_VOLUME,
              MAX_MUSIC_VOLUME
            ),
      effectsVolume:
        nextPreferences.effectsVolume === undefined
          ? previousPreferences.effectsVolume
          : clampVolume(
              nextPreferences.effectsVolume,
              MAX_EFFECTS_VOLUME,
              DEFAULT_EFFECTS_VOLUME
            )
    };

    writeCookie(ENABLED_COOKIE, String(this.preferences.enabled));
    writeCookie(MUSIC_VOLUME_COOKIE, String(this.preferences.musicVolume));
    writeCookie(EFFECTS_VOLUME_COOKIE, String(this.preferences.effectsVolume));
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
      this.preferences.effectsVolume <= 0 ||
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
    nextTrack.volume = this.preferences.effectsVolume;
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
    const shouldPlayBackground =
      this.preferences.enabled && this.preferences.musicVolume > 0;

    if (this.activeBackground) {
      this.activeBackground.volume = this.preferences.musicVolume;
      if (shouldPlayBackground) {
        this.play(this.activeBackground);
      } else {
        this.activeBackground.pause();
      }
    }

    if (this.activeEffect) {
      this.activeEffect.volume = this.preferences.effectsVolume;
      if (!this.preferences.enabled || this.preferences.effectsVolume <= 0) {
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
        this.preferences.musicVolume > 0
      ) {
        this.play(this.activeBackground);
      }
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
  }
}

export const audioManager = new AudioManager();
