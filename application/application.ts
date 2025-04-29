import { api, APIError } from "encore.dev/api";
import { db } from "../db.js";
import { randomUUID } from "node:crypto";
import { verifyLogtoAuth } from "../user/auth.js";

export interface Application {
  id: string;
  lead_id: string;
  position: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  workspace_id: string;
}

// Create a new application
export const createApplication = api(
  { method: "POST", path: "/application", expose: true },
  async ({
    lead_id,
    position,
    token,
  }: {
    lead_id: string;
    position: string;
    token: string;
  }): Promise<Application> => {
    try {
      // Verify token and get workspace_id
      const auth = await verifyLogtoAuth(token);

      // Generate UUID for the new application
      const id = randomUUID();

      const workspaceId = await db.queryRow`
        SELECT current_setting('app.workspace_id', true) as workspace_id
      `;

      if (!workspaceId?.workspace_id) {
        throw APIError.invalidArgument("No workspace selected");
      }

      // Check if lead exists
      const lead = await db.queryRow`
        SELECT id FROM lead WHERE id = ${lead_id}::uuid
      `;

      if (!lead) {
        throw APIError.invalidArgument("Lead not found");
      }

      await db.exec`
        INSERT INTO application (id, lead_id, position, workspace_id)
        VALUES (${id}::uuid, ${lead_id}::uuid, ${position}, ${workspaceId.workspace_id}::uuid)
      `;

      const newApplication = await db.queryRow`
        SELECT * FROM application WHERE id = ${id}::uuid
      `;

      return {
        id: newApplication?.id,
        lead_id: newApplication?.lead_id,
        position: newApplication?.position,
        status: newApplication?.status,
        created_at: newApplication?.created_at,
        updated_at: newApplication?.updated_at,
        workspace_id: newApplication?.workspace_id,
      };
    } catch (error) {
      console.error("Create application error:", error);
      throw APIError.internal(
        `Failed to create application: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// List all applications
export const listApplications = api(
  { method: "GET", path: "/applications", expose: true },
  async ({
    token,
  }: {
    token: string;
  }): Promise<{ applications: Application[] }> => {
    try {
      // Verify token
      await verifyLogtoAuth(token);

      const applications: Application[] = [];
      for await (const row of db.query`
        SELECT * FROM application
        ORDER BY created_at DESC
      `) {
        applications.push({
          id: row.id,
          lead_id: row.lead_id,
          position: row.position,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          workspace_id: row.workspace_id,
        });
      }

      return { applications };
    } catch (error) {
      console.error("List applications error:", error);
      throw APIError.internal(
        `Failed to list applications: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
