import { api, APIError } from "encore.dev/api";
import { db } from "../db";
import { randomUUID } from "node:crypto";
import { verifyLogtoAuth } from "../user/auth";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  source?: string;
  created_at: Date;
  updated_at: Date;
  workspace_id: string;
}

// Create a new lead
export const createLead = api(
  { method: "POST", path: "/lead", expose: true },
  async ({
    name,
    email,
    phone,
    source,
    token,
  }: {
    name: string;
    email: string;
    phone?: string;
    source?: string;
    token: string;
  }): Promise<Lead> => {
    try {
      // Verify token and get workspace_id
      const auth = await verifyLogtoAuth(token);

      const id = randomUUID();
      const workspaceId = await db.queryRow`
        SELECT current_setting('app.workspace_id', true) as workspace_id
      `;

      if (!workspaceId?.workspace_id) {
        throw APIError.invalidArgument("No workspace selected");
      }

      await db.exec`
        INSERT INTO lead (id, name, email, phone, source, workspace_id)
        VALUES (${id}, ${name}, ${email}, ${phone}, ${source}, ${workspaceId.workspace_id}::uuid)
      `;

      const newLead = await db.queryRow`
        SELECT * FROM lead WHERE id = ${id}
      `;

      return {
        id: newLead?.id,
        name: newLead?.name,
        email: newLead?.email,
        phone: newLead?.phone,
        status: newLead?.status,
        source: newLead?.source,
        created_at: newLead?.created_at,
        updated_at: newLead?.updated_at,
        workspace_id: newLead?.workspace_id,
      };
    } catch (error) {
      console.error("Create lead error:", error);
      throw APIError.internal(
        `Failed to create lead: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// List all leads
export const listLeads = api(
  { method: "GET", path: "/leads", expose: true },
  async ({ token }: { token: string }): Promise<{ leads: Lead[] }> => {
    try {
      // Verify token
      const auth = await verifyLogtoAuth(token);

      // Get current workspace_id
      const workspaceId = await db.queryRow`
        SELECT current_setting('app.workspace_id', true) as workspace_id
      `;

      if (!workspaceId?.workspace_id) {
        throw APIError.invalidArgument("No workspace selected");
      }

      const leads: Lead[] = [];
      for await (const row of db.query`
        SELECT * FROM lead 
        WHERE workspace_id = ${workspaceId.workspace_id}::uuid
        ORDER BY created_at DESC
      `) {
        leads.push({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          status: row.status,
          source: row.source,
          created_at: row.created_at,
          updated_at: row.updated_at,
          workspace_id: row.workspace_id,
        });
      }

      return { leads };
    } catch (error) {
      console.error("List leads error:", error);
      throw APIError.internal(
        `Failed to list leads: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
