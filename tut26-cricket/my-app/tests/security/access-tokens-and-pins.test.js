/**
 * File overview:
 * Purpose: Covers Access Tokens And Pins.Test behavior and regression cases in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ./README.md
 */

import {
  IMAGE_PIN_ATTEMPT_LIMIT,
  IMAGE_PIN_KIND,
  assert,
  createDirectorAccessToken,
  createMatchAccessToken,
  crypto,
  getImagePinCheckPayload,
  getImagePinPromptConfig,
  getRequiredImagePinKind,
  hasValidDirectorAccess,
  hasValidMatchAccess,
  isValidDirectorPin,
  isValidManagePin,
  isValidUmpirePin,
  test,
} from "./security-test-helpers.js";

test("[security] match access tokens validate by version and PIN checks use constant-time flow", () => {
  const previousSecret = process.env.MATCH_ACCESS_SECRET;
  const previousPin = process.env.UMPIRE_ADMIN_PIN;
  const previousPinHash = process.env.UMPIRE_ADMIN_PIN_HASH;

  process.env.MATCH_ACCESS_SECRET = "security-test-secret";
  process.env.UMPIRE_ADMIN_PIN = "0000";
  delete process.env.UMPIRE_ADMIN_PIN_HASH;

  try {
    assert.equal(isValidUmpirePin("0000"), true);
    assert.equal(isValidUmpirePin("1111"), false);

    const token = createMatchAccessToken("match-123", 2);
    assert.equal(hasValidMatchAccess("match-123", token, 2), true);
    assert.equal(hasValidMatchAccess("match-123", token, 1), false);
    assert.equal(hasValidMatchAccess("other-match", token, 2), false);
  } finally {
    if (previousSecret === undefined) delete process.env.MATCH_ACCESS_SECRET;
    else process.env.MATCH_ACCESS_SECRET = previousSecret;

    if (previousPin === undefined) delete process.env.UMPIRE_ADMIN_PIN;
    else process.env.UMPIRE_ADMIN_PIN = previousPin;

    if (previousPinHash === undefined) delete process.env.UMPIRE_ADMIN_PIN_HASH;
    else process.env.UMPIRE_ADMIN_PIN_HASH = previousPinHash;
  }
});


test("[security] manage PIN validation supports hashed env configuration", () => {
  const previousSecret = process.env.MATCH_ACCESS_SECRET;
  const previousManageSecret = process.env.SESSION_MANAGE_ACCESS_SECRET;
  const previousManagePin = process.env.SESSION_MANAGE_PIN;
  const previousManagePinHash = process.env.SESSION_MANAGE_PIN_HASH;

  process.env.MATCH_ACCESS_SECRET = "manage-hash-fallback-secret";
  process.env.SESSION_MANAGE_ACCESS_SECRET = "manage-hash-secret";
  process.env.SESSION_MANAGE_PIN = "636363";
  process.env.SESSION_MANAGE_PIN_HASH = crypto
    .scryptSync("636363", "manage-hash-secret", 64)
    .toString("hex");

  try {
    assert.equal(isValidManagePin("636363"), true);
    assert.equal(isValidManagePin("000000"), false);
  } finally {
    if (previousSecret === undefined) delete process.env.MATCH_ACCESS_SECRET;
    else process.env.MATCH_ACCESS_SECRET = previousSecret;

    if (previousManageSecret === undefined) {
      delete process.env.SESSION_MANAGE_ACCESS_SECRET;
    } else {
      process.env.SESSION_MANAGE_ACCESS_SECRET = previousManageSecret;
    }

    if (previousManagePin === undefined) delete process.env.SESSION_MANAGE_PIN;
    else process.env.SESSION_MANAGE_PIN = previousManagePin;

    if (previousManagePinHash === undefined) delete process.env.SESSION_MANAGE_PIN_HASH;
    else process.env.SESSION_MANAGE_PIN_HASH = previousManagePinHash;
  }
});


test("[security] image pin policy keeps first upload on umpire PIN and protects gallery deletes with manage PIN", () => {
  assert.equal(IMAGE_PIN_ATTEMPT_LIMIT, 4);

  assert.equal(
    getRequiredImagePinKind({
      actionType: "upload",
      plannedGalleryCount: 1,
    }),
    IMAGE_PIN_KIND.UMPIRE_OR_MANAGE
  );
  assert.equal(
    getRequiredImagePinKind({
      actionType: "upload",
      plannedGalleryCount: 2,
    }),
    IMAGE_PIN_KIND.MANAGE
  );
  assert.equal(
    getRequiredImagePinKind({
      actionType: "remove",
      plannedGalleryCount: 1,
    }),
    IMAGE_PIN_KIND.MANAGE
  );
  assert.equal(
    getRequiredImagePinKind({
      actionType: "reorder",
      plannedGalleryCount: 3,
    }),
    IMAGE_PIN_KIND.MANAGE
  );

  assert.deepEqual(
    getImagePinPromptConfig({
      actionType: "upload",
      plannedGalleryCount: 1,
    }),
    {
      pinKind: IMAGE_PIN_KIND.UMPIRE_OR_MANAGE,
      usesManagePin: false,
      digitCount: 4,
      title: "Umpire PIN",
      label: "4-digit PIN",
      placeholder: "0000",
      description: "Enter PIN to upload.",
    }
  );
  assert.deepEqual(
    getImagePinPromptConfig({
      actionType: "remove",
      plannedGalleryCount: 1,
    }),
    {
      pinKind: IMAGE_PIN_KIND.MANAGE,
      usesManagePin: true,
      digitCount: 6,
      title: "Manage PIN",
      label: "Manage PIN",
      placeholder: "- - - - - -",
      description: "Enter manage PIN to remove.",
    }
  );
  assert.deepEqual(
    getImagePinCheckPayload({
      pin: " 636363 ",
      usesManagePin: true,
    }),
    {
      pin: "636363",
      allowUmpirePin: false,
    }
  );
  assert.deepEqual(
    getImagePinCheckPayload({
      pin: "0000",
      usesManagePin: false,
    }),
    {
      pin: "0000",
      allowUmpirePin: true,
    }
  );
});


test("[security] director access tokens validate and director PIN uses the configured secret", () => {
  const previousSecret = process.env.MATCH_ACCESS_SECRET;
  const previousDirectorPin = process.env.DIRECTOR_CONSOLE_PIN;
  const previousDirectorPinHash = process.env.DIRECTOR_CONSOLE_PIN_HASH;

  process.env.MATCH_ACCESS_SECRET = "director-test-secret";
  process.env.DIRECTOR_CONSOLE_PIN = "0000";
  delete process.env.DIRECTOR_CONSOLE_PIN_HASH;

  try {
    assert.equal(isValidDirectorPin("0000"), true);
    assert.equal(isValidDirectorPin("1234"), false);

    const token = createDirectorAccessToken();
    assert.equal(hasValidDirectorAccess(token), true);
    const [payload, signature] = token.split(".");
    const tamperedToken = `${payload}.${signature.slice(0, -1)}x`;
    assert.equal(hasValidDirectorAccess(tamperedToken), false);
  } finally {
    if (previousSecret === undefined) delete process.env.MATCH_ACCESS_SECRET;
    else process.env.MATCH_ACCESS_SECRET = previousSecret;

    if (previousDirectorPin === undefined) delete process.env.DIRECTOR_CONSOLE_PIN;
    else process.env.DIRECTOR_CONSOLE_PIN = previousDirectorPin;

    if (previousDirectorPinHash === undefined) delete process.env.DIRECTOR_CONSOLE_PIN_HASH;
    else process.env.DIRECTOR_CONSOLE_PIN_HASH = previousDirectorPinHash;
  }
});


