export const RANDOM_SCORE_EFFECT_ID = "__random__";

export const SCORE_SOUND_EFFECT_EVENTS = [
  {
    key: "dot",
    label: "Dot",
    buttonLabel: "Dot",
    buttonTone: "dot",
    buttonTextClassName: "text-[1.28rem]",
    runs: 0,
    isOut: false,
    extraType: null,
  },
  {
    key: "one",
    label: "1 Run",
    buttonLabel: "1",
    buttonTone: "neutral",
    buttonTextClassName: "text-[1.45rem]",
    runs: 1,
    isOut: false,
    extraType: null,
  },
  {
    key: "two",
    label: "2 Runs",
    buttonLabel: "2",
    buttonTone: "neutral",
    buttonTextClassName: "text-[1.45rem]",
    runs: 2,
    isOut: false,
    extraType: null,
  },
  {
    key: "three",
    label: "3 Runs",
    buttonLabel: "3",
    buttonTone: "neutral",
    buttonTextClassName: "text-[1.45rem]",
    runs: 3,
    isOut: false,
    extraType: null,
  },
  {
    key: "four",
    label: "4 Runs",
    buttonLabel: "4",
    buttonTone: "neutral",
    buttonTextClassName: "text-[1.45rem]",
    runs: 4,
    isOut: false,
    extraType: null,
  },
  {
    key: "six",
    label: "6 Runs",
    buttonLabel: "6",
    buttonTone: "neutral",
    buttonTextClassName: "text-[1.45rem]",
    runs: 6,
    isOut: false,
    extraType: null,
  },
  {
    key: "out",
    label: "Out",
    buttonLabel: "OUT",
    buttonTone: "out",
    buttonTextClassName: "text-[1.1rem]",
    runs: 0,
    isOut: true,
    extraType: null,
  },
  {
    key: "wide_zero",
    label: "Wide 0",
    buttonLabel: "WIDE 0",
    buttonTone: "wide",
    buttonTextClassName: "text-[0.92rem]",
    runs: 0,
    isOut: false,
    extraType: "wide",
  },
  {
    key: "wide_plus_one",
    label: "Wide +1",
    buttonLabel: "WIDE +1",
    buttonTone: "wide",
    buttonTextClassName: "text-[0.84rem]",
    runs: 1,
    isOut: false,
    extraType: "wide",
  },
  {
    key: "noball",
    label: "No Ball",
    buttonLabel: "NO BALL",
    buttonTone: "noball",
    buttonTextClassName: "text-[0.94rem]",
    runs: 0,
    isOut: false,
    extraType: "noball",
  },
];

export const SCORE_SOUND_EFFECT_KEYS = SCORE_SOUND_EFFECT_EVENTS.map(
  (event) => event.key,
);

export const EMPTY_SCORE_SOUND_EFFECT_MAP = SCORE_SOUND_EFFECT_EVENTS.reduce(
  (map, event) => ({
    ...map,
    [event.key]: "",
  }),
  {},
);

export function normalizeScoreSoundEffectMap(input = {}) {
  return SCORE_SOUND_EFFECT_KEYS.reduce(
    (map, key) => ({
      ...map,
      [key]: String(input?.[key] || "").trim(),
    }),
    { ...EMPTY_SCORE_SOUND_EFFECT_MAP },
  );
}

export function getScoreSoundEffectMapSignature(input = {}) {
  return SCORE_SOUND_EFFECT_KEYS.map(
    (key) => `${key}:${String(input?.[key] || "").trim()}`,
  ).join("|");
}

export function hasAssignedScoreSoundEffectMap(input = {}) {
  return SCORE_SOUND_EFFECT_KEYS.some((key) =>
    Boolean(String(input?.[key] || "").trim()),
  );
}

export function shouldHydrateScoreSoundEffectMapFromRemote(
  remoteMap = {},
  currentSignature = "",
  hasUnsavedLocalChanges = false,
) {
  if (hasUnsavedLocalChanges) {
    return false;
  }

  if (!hasAssignedScoreSoundEffectMap(remoteMap)) {
    return false;
  }

  return getScoreSoundEffectMapSignature(remoteMap) !== currentSignature;
}

export function getScoreSoundEffectEventKey(
  runs,
  isOut = false,
  extraType = null,
) {
  if (extraType === "wide") {
    return Number(runs) > 0 ? "wide_plus_one" : "wide_zero";
  }

  if (extraType === "noball") {
    return "noball";
  }

  if (isOut) {
    return "out";
  }

  if (Number(runs) === 0) {
    return "dot";
  }

  if (Number(runs) === 1) {
    return "one";
  }

  if (Number(runs) === 2) {
    return "two";
  }

  if (Number(runs) === 3) {
    return "three";
  }

  if (Number(runs) === 4) {
    return "four";
  }

  if (Number(runs) === 6) {
    return "six";
  }

  return "";
}

export function getScoreSoundEffectPreviewInput(eventKey) {
  const event =
    SCORE_SOUND_EFFECT_EVENTS.find((item) => item.key === eventKey) || null;

  if (!event) {
    return null;
  }

  return {
    runs: Number(event.runs || 0),
    isOut: Boolean(event.isOut),
    extraType: event.extraType || null,
  };
}
