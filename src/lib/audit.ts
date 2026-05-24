import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "SIGN"
  | "SIGN_REVOKE"
  | "EMBED_PDF"
  | "BIND_DOCUMENT"
  | "LOGIN"
  | "PROFILE_UPDATE"
  | "PROFILE_LOGO_UPLOAD"
  | "PROFILE_LOGO_REMOVE"
  | "USER_CREATE";

export async function logAudit(params: {
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId ?? null,
        metadata:
          (params.metadata as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record audit log", err);
  }
}
