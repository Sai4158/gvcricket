import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { isSafeMatchImageUrl } from "./match-image";
import { formatZodError } from "./request-security";

function sanitizePlainText(value) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStringSchema({ min = 0, max = 120, allowEmpty = false } = {}) {
  const schema = z
    .string()
    .max(max)
    .transform((value) => sanitizePlainText(value));

  if (allowEmpty) {
    return schema.refine((value) => value.length <= max, {
      message: "Value is too long.",
    });
  }

  return schema.refine((value) => value.length >= min, {
    message: "Value is required.",
  });
}

const optionalStringSchema = buildStringSchema({ max: 240, allowEmpty: true });
const requiredNameSchema = buildStringSchema({ min: 1, max: 80 });
const playerNameSchema = buildStringSchema({ min: 1, max: 48 });
const playerArraySchema = z.array(playerNameSchema).min(1).max(15);
const oversSchema = z.number().int().min(1).max(50);
const draftTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32,96}$/i, "draftToken is invalid.");
const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "PIN must be 4 digits.");
const ballSchema = z
  .object({
    runs: z.number().int().min(0).max(7),
    isOut: z.boolean().default(false),
    extraType: z.enum(["wide", "noball", "byes", "legbyes"]).nullable().optional(),
    batsmanOnStrike: optionalStringSchema.optional(),
  })
  .strict();
const overSchema = z
  .object({
    overNumber: z.number().int().min(1),
    balls: z.array(ballSchema).max(12),
    bowler: optionalStringSchema.optional(),
  })
  .strict();
const inningsSchema = z
  .object({
    team: optionalStringSchema.default(""),
    score: z.number().int().min(0),
    history: z.array(overSchema),
  })
  .strict();

export const sessionCreateSchema = z
  .object({
    name: requiredNameSchema,
    date: optionalStringSchema.default(""),
  })
  .strict();

export const setupMatchSchema = z
  .object({
    teamAName: requiredNameSchema,
    teamBName: requiredNameSchema,
    teamAPlayers: playerArraySchema,
    teamBPlayers: playerArraySchema,
    overs: z.coerce.number().int().min(1).max(50),
    draftToken: draftTokenSchema.optional(),
  })
  .strict();

export const sessionDraftDeleteSchema = z
  .object({
    draftToken: draftTokenSchema,
  })
  .strict();

export const pinPayloadSchema = z
  .object({
    pin: pinSchema,
  })
  .strict();

export const sessionPatchObjectSchema = z
  .object({
    name: requiredNameSchema.optional(),
    date: optionalStringSchema.optional(),
    isLive: z.boolean().optional(),
    overs: oversSchema.nullable().optional(),
    teamAName: requiredNameSchema.optional(),
    teamBName: requiredNameSchema.optional(),
    teamA: playerArraySchema.optional(),
    teamB: playerArraySchema.optional(),
    tossWinner: optionalStringSchema.optional(),
    announcerEnabled: z.boolean().optional(),
    announcerMode: z.enum(["simple", "full", ""]).optional(),
    matchImageUrl: optionalStringSchema
      .refine((value) => !value || isSafeMatchImageUrl(value), {
        message: "matchImageUrl is invalid.",
      })
      .optional(),
    matchImagePublicId: optionalStringSchema.optional(),
    matchImageUploadedAt: z.coerce.date().optional(),
    matchImageUploadedBy: optionalStringSchema.optional(),
    lastEventType: optionalStringSchema.optional(),
    lastEventText: optionalStringSchema.optional(),
    adminAccessVersion: z.number().int().min(0).optional(),
  })
  .strict();

export const sessionPatchSchema = sessionPatchObjectSchema.refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "No valid session fields provided.",
  });

export const matchPatchObjectSchema = z
  .object({
    teamAName: requiredNameSchema.optional(),
    teamBName: requiredNameSchema.optional(),
    teamA: playerArraySchema.optional(),
    teamB: playerArraySchema.optional(),
    overs: oversSchema.optional(),
    announcerEnabled: z.boolean().optional(),
    announcerMode: z.enum(["simple", "full", ""]).optional(),
  })
  .strict();

const walkieParticipantSchema = z
  .string()
  .min(8)
  .max(80)
  .regex(/^[a-zA-Z0-9._:-]+$/, "participantId is invalid.");

const walkieRoleSchema = z.enum(["umpire", "spectator", "director"]);

export const walkieToggleSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const walkieClaimSchema = z
  .object({
    participantId: walkieParticipantSchema,
    role: walkieRoleSchema,
    token: z.string().min(16).max(400),
  })
  .strict();

export const walkieReleaseSchema = z
  .object({
    participantId: walkieParticipantSchema,
    role: walkieRoleSchema,
    token: z.string().min(16).max(400),
  })
  .strict();

export const walkieRequestSchema = z
  .object({
    participantId: walkieParticipantSchema,
    role: z.enum(["spectator", "director"]),
    token: z.string().min(16).max(400),
  })
  .strict();

export const walkieRespondSchema = z
  .object({
    requestId: z.string().min(12).max(140),
    action: z.enum(["accept", "dismiss"]),
  })
  .strict();

export const walkieSignalSchema = z
  .object({
    participantId: walkieParticipantSchema,
    role: walkieRoleSchema,
    token: z.string().min(16).max(400),
    toId: walkieParticipantSchema,
    payload: z
      .object({
        type: z.enum(["offer", "answer", "ice-candidate"]),
        sdp: z.string().max(120000).optional(),
        candidate: z.string().max(10000).optional(),
        sdpMid: z.string().max(100).optional(),
        sdpMLineIndex: z.number().int().min(0).max(32).optional(),
        transmissionId: z.string().min(1).max(160).optional(),
        attempt: z.number().int().min(1).max(8).optional(),
      })
      .strict(),
  })
  .strict();

export const matchPatchSchema = matchPatchObjectSchema.refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "No valid match fields provided.",
  });

const actionBaseSchema = z.object({
  actionId: z
    .string()
    .min(8)
    .max(80)
    .regex(/^[a-zA-Z0-9._:-]+$/, "actionId is invalid."),
});

export const matchActionSchema = z.discriminatedUnion("type", [
  actionBaseSchema
    .extend({
      type: z.literal("score_ball"),
      runs: z.number().int().min(0).max(7),
      isOut: z.boolean().default(false),
      extraType: z.enum(["wide", "noball"]).nullable().default(null),
    })
    .refine(
      (value) => {
        if (value.extraType === "wide") {
          return value.runs >= 0;
        }

        if (value.extraType === "noball") {
          return value.runs >= 0;
        }

        return value.runs <= 6;
      },
      {
        message: "runs is invalid.",
        path: ["runs"],
      }
    )
    .strict(),
  actionBaseSchema
    .extend({
      type: z.literal("undo_last"),
    })
    .strict(),
  actionBaseSchema
    .extend({
      type: z.literal("complete_innings"),
    })
    .strict(),
  actionBaseSchema
    .extend({
      type: z.literal("set_toss"),
      tossWinner: requiredNameSchema,
      tossDecision: z.enum(["bat", "bowl"]),
    })
    .strict(),
]);

function validateWithSchema(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      message: formatZodError(parsed.error),
    };
  }

  return {
    ok: true,
    value: parsed.data,
  };
}

export function validateSessionCreatePayload(body) {
  return validateWithSchema(sessionCreateSchema, body);
}

export function validateSetupMatchPayload(body) {
  return validateWithSchema(setupMatchSchema, body);
}

export function validatePinPayload(body) {
  return validateWithSchema(pinPayloadSchema, body);
}

export function validateSessionPatchPayload(body) {
  return validateWithSchema(sessionPatchSchema, body);
}

export function validateSessionDraftDeletePayload(body) {
  return validateWithSchema(sessionDraftDeleteSchema, body);
}

export function validateMatchPatchPayload(body) {
  return validateWithSchema(matchPatchSchema, body);
}

export function validateMatchActionPayload(body) {
  return validateWithSchema(matchActionSchema, body);
}

export function validateWalkieTogglePayload(body) {
  return validateWithSchema(walkieToggleSchema, body);
}

export function validateWalkieClaimPayload(body) {
  return validateWithSchema(walkieClaimSchema, body);
}

export function validateWalkieReleasePayload(body) {
  return validateWithSchema(walkieReleaseSchema, body);
}

export function validateWalkieRequestPayload(body) {
  return validateWithSchema(walkieRequestSchema, body);
}

export function validateWalkieSignalPayload(body) {
  return validateWithSchema(walkieSignalSchema, body);
}

export { draftTokenSchema, inningsSchema, oversSchema, pinSchema };
