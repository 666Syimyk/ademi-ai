export const maxAvatarBytes = 3 * 1024 * 1024;

export const allowedAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const avatarExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function ownsAvatarKey(userId: string, key: string | null) {
  return Boolean(key?.startsWith(`avatars/${userId}/`));
}

export function hasExpectedAvatarSignature(
  bytes: Uint8Array,
  mimeType: string,
) {
  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      bytes.length >= signature.length &&
      signature.every((value, index) => bytes[index] === value)
    );
  }
  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}
