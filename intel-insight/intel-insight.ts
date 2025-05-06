import { api, APIError } from "encore.dev/api";
import { db } from "../db";
import { randomUUID } from "node:crypto";
import { verifyLogtoAuth } from "../user/auth";
import { createAuditLog } from "../audit_log/audit_log";

export interface IntelInsight {
  id: string;
  content: string;
  created_by: string;
  created_at: Date;
  workspace_id: string;
}

// POST /insight
export const createInsight = api(
  { method: "POST", path: "/insight", expose: true },
  async ({
    content,
    token,
  }: {
    content: string;
    token: string;
  }): Promise<IntelInsight> => {
    try {
      const auth = await verifyLogtoAuth(token);
      console.log("auth", auth);
      
      const workspaceId = auth.workspaceId;
      if (!workspaceId) {
        throw new Error("No workspace ID found in auth context");
      }

      const id = randomUUID();

      await db.exec`
        INSERT INTO insight (id, content, created_by, workspace_id)
        VALUES (
          ${id}::uuid,
          ${content},
          ${auth.userId},
          ${workspaceId}::uuid
        )
      `;

      // Ghi log vào bảng audit_log
      await createAuditLog({
        user_id: auth.userId,
        action: "create_insight",
        target_id: id,
        workspace_id: workspaceId,
      });

      const newInsight = await db.queryRow`
        SELECT * FROM insight WHERE id = ${id}::uuid
      `;

      return {
        id: newInsight?.id,
        content: newInsight?.content,
        created_by: newInsight?.created_by,
        created_at: newInsight?.created_at,
        workspace_id: newInsight?.workspace_id,
      };
    } catch (error) {
      console.error("Create insight error:", error);
      throw APIError.internal(
        `Failed to create insight: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// GET /insights
export const listInsights = api(
  { method: "GET", path: "/insights", expose: true },
  async ({
    token,
  }: {
    token: string;
  }): Promise<{ insights: IntelInsight[] }> => {
    try {
      await verifyLogtoAuth(token);

      const insights: IntelInsight[] = [];
      for await (const row of db.query`
        SELECT * FROM insight ORDER BY created_at DESC
      `) {
        insights.push({
          id: row?.id,
          content: row?.content,
          created_by: row?.created_by,
          created_at: row?.created_at,
          workspace_id: row?.workspace_id,
        });
      }

      return { insights };
    } catch (error) {
      console.error("List insights error:", error);
      throw APIError.internal(
        `Failed to list insights: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
