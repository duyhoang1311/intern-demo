// audit_log/audit_log.ts
import { api, APIError } from "encore.dev/api";
import { db } from "../db";
import { randomUUID } from "node:crypto";
import { verifyLogtoAuth } from "../user/auth";

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_id?: string;
  workspace_id: string;
  created_at: Date;
}

// API: Lấy danh sách audit log của workspace
export const getAuditLogs = api(
  { method: "GET", path: "/audit-log", expose: true },
  async (params: { authorization?: string; limit?: number }) => {
    if (!params.authorization || !params.authorization.startsWith("Bearer ")) {
      throw APIError.unauthenticated("Missing or invalid token");
    }
    const token = params.authorization.split(" ")[1];
    const auth = await verifyLogtoAuth(token);

    if (!auth.workspaceId) {
      throw APIError.permissionDenied("No workspace access");
    }

    const result = db.query`
      SELECT * FROM audit_log
      WHERE workspace_id = ${auth.workspaceId}
      ORDER BY created_at DESC
      LIMIT ${params.limit ?? 50}
    `;
    
    const logs: AuditLog[] = [];
    for await (const row of result) {
      logs.push(row as AuditLog);
    }
    
    return { logs };
  }
);

// API: Ghi log audit (nếu muốn expose cho các service khác)
export const createAuditLog = api(
  { method: "POST", path: "/audit-log", expose: false }, // expose: false nếu chỉ dùng nội bộ
  async (params: {
    user_id: string;
    action: string;
    target_id?: string;
    workspace_id: string;
  }) => {
    await db.exec`
      INSERT INTO audit_log (id, user_id, action, target_id, workspace_id, metadata, created_at)
      VALUES (
        ${randomUUID()},
        ${params.user_id},
        ${params.action},
        ${params.target_id ?? null},
        ${params.workspace_id},
        CURRENT_TIMESTAMP
      )
    `;
    return { success: true };
  }
);