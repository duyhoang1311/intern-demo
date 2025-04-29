import { api, APIError } from "encore.dev/api";
import { db } from "../db";
import { randomUUID } from "node:crypto";
import { verifyLogtoAuth } from "../user/auth";

export interface Offer {
  id: string;
  application_id: string;
  salary: number;
  benefits?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  workspace_id: string;
}

// Create a new offer
export const createOffer = api(
  { method: "POST", path: "/offer", expose: true },
  async ({
    application_id,
    salary,
    benefits,
    token,
  }: {
    application_id: string;
    salary: number;
    benefits?: string;
    token: string;
  }): Promise<Offer> => {
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

      // Convert salary to string and use it directly
      const salaryStr = salary.toString();

      const newOffer = await db.queryRow`
        INSERT INTO offer (id, application_id, salary, benefits, workspace_id)
        VALUES (${id}, ${application_id}::uuid, ${salary}, ${benefits}, ${workspaceId.workspace_id}::uuid)
        RETURNING *
      `;

      return {
        id: newOffer?.id,
        application_id: newOffer?.application_id,
        salary: parseFloat(newOffer?.salary),
        benefits: newOffer?.benefits,
        status: newOffer?.status,
        created_at: newOffer?.created_at,
        updated_at: newOffer?.updated_at,
        workspace_id: newOffer?.workspace_id,
      };
    } catch (error) {
      console.error("Create offer error:", error);
      throw APIError.internal(
        `Failed to create offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// List all offers
export const listOffers = api(
  { method: "GET", path: "/offers", expose: true },
  async ({ token }: { token: string }): Promise<{ offers: Offer[] }> => {
    try {
      // Verify token
      await verifyLogtoAuth(token);

      const offers: Offer[] = [];
      for await (const row of db.query`
        SELECT * FROM offer
        ORDER BY created_at DESC
      `) {
        offers.push({
          id: row.id,
          application_id: row.application_id,
          salary: row.salary,
          benefits: row.benefits,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          workspace_id: row.workspace_id,
        });
      }

      return { offers };
    } catch (error) {
      console.error("List offers error:", error);
      throw APIError.internal(
        `Failed to list offers: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
