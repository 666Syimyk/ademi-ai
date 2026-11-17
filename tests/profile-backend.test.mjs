import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadAvatarValidation() {
  const source = await readFile(
    new URL("../app/api/me/avatar/validation.ts", import.meta.url),
    "utf8",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  );
}

test("avatar validation permits only the supported image formats and 3 MB", async () => {
  const { allowedAvatarMimeTypes, maxAvatarBytes } =
    await loadAvatarValidation();
  assert.deepEqual(
    [...allowedAvatarMimeTypes],
    ["image/jpeg", "image/png", "image/webp"],
  );
  assert.equal(maxAvatarBytes, 3 * 1024 * 1024);
  assert.equal(allowedAvatarMimeTypes.has("image/svg+xml"), false);
  assert.equal(allowedAvatarMimeTypes.has("text/html"), false);
});

test("avatar signatures are checked against the declared MIME type", async () => {
  const { hasExpectedAvatarSignature } = await loadAvatarValidation();
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);

  assert.equal(hasExpectedAvatarSignature(jpeg, "image/jpeg"), true);
  assert.equal(hasExpectedAvatarSignature(png, "image/png"), true);
  assert.equal(hasExpectedAvatarSignature(webp, "image/webp"), true);
  assert.equal(hasExpectedAvatarSignature(png, "image/jpeg"), false);
  assert.equal(
    hasExpectedAvatarSignature(
      new TextEncoder().encode("<svg><script/></svg>"),
      "image/png",
    ),
    false,
  );
});

test("avatar ownership is scoped to the authenticated user's immutable prefix", async () => {
  const { ownsAvatarKey } = await loadAvatarValidation();
  assert.equal(ownsAvatarKey("user-a", "avatars/user-a/random.webp"), true);
  assert.equal(ownsAvatarKey("user-a", "avatars/user-ab/random.webp"), false);
  assert.equal(ownsAvatarKey("user-a", "avatars/user-b/random.webp"), false);
  assert.equal(ownsAvatarKey("user-a", null), false);
});

test("avatar replacement uses compare-and-set and deletes the old owned object last", async () => {
  const route = await readFile(
    new URL("../app/api/me/avatar/route.ts", import.meta.url),
    "utf8",
  );
  const putAt = route.indexOf("MATERIALS.put(newKey");
  const compareAt = route.indexOf("ownershipCondition");
  const updateAt = route.indexOf(".update(users)", compareAt);
  const deleteOldAt = route.indexOf(
    "removeOwnedAvatar(user.id, currentKey)",
    updateAt,
  );

  assert.ok(putAt >= 0, "new bytes must be written to private R2");
  assert.ok(compareAt > putAt, "the prior D1 owner metadata must be captured");
  assert.ok(updateAt > compareAt, "D1 must be updated with a CAS condition");
  assert.ok(deleteOldAt > updateAt, "the old object is deleted only after replacement");
  assert.match(route, /and\(eq\(users\.id, user\.id\), ownershipCondition\)/);
  assert.match(route, /customMetadata:\s*\{\s*ownerId: user\.id/);
  assert.match(route, /Cache-Control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(route, /readAsDataURL|base64/i);
});

test("profile migration and snapshot contain additive epoch-ms avatar metadata", async () => {
  const [migration, snapshotText] = await Promise.all([
    readFile(new URL("../drizzle/0002_rich_xorn.sql", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/meta/0002_snapshot.json", import.meta.url),
      "utf8",
    ),
  ]);
  const snapshot = JSON.parse(snapshotText);
  const columns = snapshot.tables.users.columns;

  for (const column of [
    "profile_completed_at",
    "avatar_r2_key",
    "avatar_mime_type",
    "avatar_size_bytes",
    "avatar_updated_at",
  ]) {
    assert.ok(
      migration.includes("ADD `" + column + "`"),
      `${column} should be present in the migration`,
    );
    assert.ok(columns[column], `${column} should be present in the snapshot`);
  }
  assert.equal(columns.profile_completed_at.type, "integer");
  assert.equal(columns.avatar_updated_at.type, "integer");
  assert.equal(
    snapshot.tables.users.indexes.idx_users_avatar_r2_key.isUnique,
    true,
  );
});
