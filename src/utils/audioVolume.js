export const MIN_VOLUME_PERCENT = 1;
export const MAX_VOLUME_PERCENT = 100;

function clampVolumePercent(value) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return MIN_VOLUME_PERCENT;
  }
  return Math.min(
    MAX_VOLUME_PERCENT,
    Math.max(MIN_VOLUME_PERCENT, Math.round(parsedValue))
  );
}

export function volumeToPercent(volume, maximum) {
  const parsedMaximum = Number(maximum);
  if (!Number.isFinite(parsedMaximum) || parsedMaximum <= 0) {
    return MIN_VOLUME_PERCENT;
  }
  return clampVolumePercent((Number(volume) / parsedMaximum) * MAX_VOLUME_PERCENT);
}

export function percentToVolume(percent, maximum) {
  const parsedMaximum = Number(maximum);
  if (!Number.isFinite(parsedMaximum) || parsedMaximum <= 0) {
    return 0;
  }
  return (clampVolumePercent(percent) / MAX_VOLUME_PERCENT) * parsedMaximum;
}
