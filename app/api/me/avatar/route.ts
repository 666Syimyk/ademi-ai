import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAppUser } from "@/lib/server/auth";
import { ApiError, jsonError } from "@/lib/server/http";
import { runtimeEnv } from "@/lib/server/runtime";
import {
  allowedAvatarMimeTypes,
  avatarExtensions,
  hasExpectedAvatarSignature,
  maxAvatarBytes,
  ownsAvatarKey,
} from "./validation";

function avatarUrl(updatedAt: number) {
  return `/api/me/avatar?v=${updatedAt}`;
}

async function removeOwnedAvatar(userId: string, key: string | null) {
  if (!ownsAvatarKey(userId, key) || !key) return;
  try {
    await runtimeEnv().MATERIALS.delete(key);
  } catch {
    // The database remains authoritative. A private orphaned object is safer
    // than rolling the profile back to an object that may already be gone.
    console.warn("Failed to remove an obsolete private avatar object");
  }
}

export async function GET() {
  try {
    const user = await requireAppUser();
    if (
      !user.avatarR2Key ||
      !user.avatarMimeType ||
      !allowedAvatarMimeTypes.has(user.avatarMimeType) ||
      !ownsAvatarKey(user.id, user.avatarR2Key)
    ) {
      throw new ApiError(404, "Фотография не найдена", "avatar_not_found");
    }

    const object = await runtimeEnv().MATERIALS.get(user.avatarR2Key);
    if (
      !object?.body ||
      object.customMetadata?.ownerId !== user.id
    ) {
      throw new ApiError(404, "Фотография не найдена", "avatar_not_found");
    }

    const extension = avatarExtensions[user.avatarMimeType] ?? "img";
    return new Response(object.body, {
      headers: {
        "Content-Type": user.avatarMimeType,
        "Content-Disposition": `inline; filename="profile.${extension}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  let newKey: string | null = null;
  let userId: string | null = null;
  try {
    const user = await requireAppUser();
    userId = user.id;
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError(400, "Некорректная загрузка", "invalid_form_data");
    }
    const avatar = form.get("avatar");
    if (!(avatar instanceof File)) {
      throw new ApiError(422, "Выберите фотографию", "avatar_required");
    }
    if (!allowedAvatarMimeTypes.has(avatar.type)) {
      throw new ApiError(
        415,
        "Поддерживаются только JPEG, PNG и WebP",
        "unsupported_avatar_type",
      );
    }
    if (avatar.size <= 0 || avatar.size > maxAvatarBytes) {
      throw new ApiError(
        413,
        "Размер фотографии не должен превышать 3 МБ",
        "avatar_too_large",
      );
    }

    const bytes = await avatar.arrayBuffer();
    if (!hasExpectedAvatarSignature(new Uint8Array(bytes), avatar.type)) {
      throw new ApiError(
        415,
        "Содержимое файла не соответствует формату изображения",
        "invalid_avatar_content",
      );
    }

    const now = Date.now();
    const extension = avatarExtensions[avatar.type];
    newKey = `avatars/${user.id}/${crypto.randomUUID()}.${extension}`;
    await runtimeEnv().MATERIALS.put(newKey, bytes, {
      httpMetadata: {
        contentType: avatar.type,
        cacheControl: "private, no-store",
      },
      customMetadata: {
        ownerId: user.id,
        uploadedAt: String(now),
      },
    });

    const currentKey = user.avatarR2Key;
    const ownershipCondition = currentKey
      ? eq(users.avatarR2Key, currentKey)
      : isNull(users.avatarR2Key);
    const [saved] = await getDb()
      .update(users)
      .set({
        avatarR2Key: newKey,
        avatarMimeType: avatar.type as
          | "image/jpeg"
          | "image/png"
          | "image/webp",
        avatarSizeBytes: avatar.size,
        avatarUpdatedAt: now,
        updatedAt: now,
      })
      .where(and(eq(users.id, user.id), ownershipCondition))
      .returning({ avatarUpdatedAt: users.avatarUpdatedAt });

    if (!saved?.avatarUpdatedAt) {
      await removeOwnedAvatar(user.id, newKey);
      newKey = null;
      throw new ApiError(
        409,
        "Профиль уже изменился. Повторите загрузку",
        "profile_conflict",
      );
    }

    newKey = null;
    await removeOwnedAvatar(user.id, currentKey);
    return Response.json(
      { avatarUrl: avatarUrl(saved.avatarUpdatedAt) },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (newKey && userId) await removeOwnedAvatar(userId, newKey);
    return jsonError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireAppUser();
    if (!user.avatarR2Key) {
      return Response.json(
        { avatarUrl: null, deleted: false },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const now = Date.now();
    const [saved] = await getDb()
      .update(users)
      .set({
        avatarR2Key: null,
        avatarMimeType: null,
        avatarSizeBytes: null,
        avatarUpdatedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(users.id, user.id),
          eq(users.avatarR2Key, user.avatarR2Key),
        ),
      )
      .returning({ id: users.id });

    if (!saved) {
      throw new ApiError(
        409,
        "Профиль уже изменился. Повторите удаление",
        "profile_conflict",
      );
    }
    await removeOwnedAvatar(user.id, user.avatarR2Key);
    return Response.json(
      { avatarUrl: null, deleted: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
