import { api, APIError } from "encore.dev/api";
import { QuoteService } from "../services/quoteService";
import { verifyLogtoAuth } from "../user/auth";
import { randomUUID } from "node:crypto";
import { ClickHouseService } from "../services/clickhouseService";
import { db } from "../db";

// Define interfaces
export interface Quote {
  id: string;
  workspace_id: string;
  lead_id: string;
  offer_id: string;
  created_by: string;
  price: number;
  status: string;
  sent_at?: Date;
  converted_at?: Date;
  created_at: Date;
}

interface CreateQuoteResponse {
  success: boolean;
  quote_id: string;
}

// API endpoint để tạo quote mới
export const createQuote = api(
  { method: "POST", path: "/quote", expose: true },
  async (params: {
    quote: Omit<Quote, "id" | "created_at">;
    authorization?: string;
  }): Promise<CreateQuoteResponse> => {
    try {
      console.log(
        "Creating quote with params:",
        JSON.stringify(params, null, 2)
      );

      // Verify authentication
      if (
        !params.authorization ||
        !params.authorization.startsWith("Bearer ")
      ) {
        throw APIError.unauthenticated("Missing or invalid token");
      }
      const token = params.authorization.split(" ")[1];
      console.log("Verifying auth with token:", token);
      const auth = await verifyLogtoAuth(token);
      console.log("Auth context:", JSON.stringify(auth, null, 2));

      // Verify workspace access
      if (!auth.workspaceId) {
        throw APIError.permissionDenied("No workspace access");
      }

      // Verify workspace match
      if (params.quote.workspace_id !== auth.workspaceId) {
        throw APIError.permissionDenied(
          `Workspace mismatch: quote workspace ${params.quote.workspace_id} != auth workspace ${auth.workspaceId}`
        );
      }

      const quote_id = randomUUID();
      console.log("Creating quote with quote_id:", quote_id);

      // Create quote
      const quoteService = new QuoteService();
      const quote = {
        ...params.quote,
        id: quote_id,
        created_at: new Date(),
      };
      console.log(
        "Creating quote in PostgreSQL:",
        JSON.stringify(quote, null, 2)
      );
      await quoteService.createQuote(quote);
      console.log("Quote created successfully in PostgreSQL");

      try {
        // Track quote creation event
        const clickhouseService = ClickHouseService.getInstance();
        const event = {
          id: randomUUID(),
          quote_id,
          event_type: "created",
          event_data: JSON.stringify({
            amount: quote.price,
            currency: "USD",
          }),
          created_at: new Date(),
          user_id: auth.userId,
          workspace_id: auth.workspaceId,
        };
        console.log(
          "Creating quote event in ClickHouse:",
          JSON.stringify(event, null, 2)
        );
        await clickhouseService.insertQuoteEvent(event);
        console.log("Quote event created successfully in ClickHouse");
      } catch (trackingError) {
        console.error("Error tracking quote event:", trackingError);
        // Don't throw error here, just log it
      }

      return { success: true, quote_id };
    } catch (error) {
      console.error("Create quote error:", error);
      if (error instanceof Error) {
        console.error("Error stack:", error.stack);
        console.error("Error message:", error.message);
      }
      throw APIError.internal(
        `Failed to create quote: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để cập nhật trạng thái quote
export const updateQuoteStatus = api(
  { method: "PUT", path: "/quote/:id/status", expose: true },
  async (params: {
    id: string;
    status: string;
    authorization?: string;
  }): Promise<{ success: boolean }> => {
    try {
      // Verify authentication
      if (
        !params.authorization ||
        !params.authorization.startsWith("Bearer ")
      ) {
        throw APIError.unauthenticated("Missing or invalid token");
      }
      const token = params.authorization.split(" ")[1];
      const auth = await verifyLogtoAuth(token);

      // Verify workspace access
      if (!auth.workspaceId) {
        throw APIError.permissionDenied("No workspace access");
      }

      const quoteService = new QuoteService();
      const quote = await quoteService.getQuoteById(params.id);

      if (!quote) {
        throw APIError.notFound("Quote not found");
      }

      // Verify workspace match
      if (quote.workspace_id !== auth.workspaceId) {
        throw APIError.permissionDenied("Workspace mismatch");
      }

      // Update quote status
      await db.exec`
        UPDATE quotes 
        SET status = ${params.status},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${params.id}::uuid
      `;

      // Track status update event
      try {
        const clickhouseService = ClickHouseService.getInstance();
        await clickhouseService.insertQuoteEvent({
          id: randomUUID(),
          quote_id: params.id,
          event_type: params.status,
          event_data: JSON.stringify({
            amount: quote.price,
            currency: "USD",
          }),
          created_at: new Date(),
          user_id: auth.userId,
          workspace_id: auth.workspaceId,
        });
      } catch (trackingError) {
        console.error("Error tracking quote status update:", trackingError);
      }

      return { success: true };
    } catch (error) {
      console.error("Update quote status error:", error);
      throw APIError.internal(
        `Failed to update quote status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để lấy danh sách quotes
export const listQuotes = api(
  { method: "GET", path: "/quotes", expose: true },
  async (params: { authorization?: string }): Promise<{ quotes: Quote[] }> => {
    try {
      // Verify authentication
      if (
        !params.authorization ||
        !params.authorization.startsWith("Bearer ")
      ) {
        throw APIError.unauthenticated("Missing or invalid token");
      }
      const token = params.authorization.split(" ")[1];
      const auth = await verifyLogtoAuth(token);

      // Verify workspace access
      if (!auth.workspaceId) {
        throw APIError.permissionDenied("No workspace access");
      }

      const quoteService = new QuoteService();
      const quotes = await quoteService.getQuotesByWorkspace(auth.workspaceId);

      return { quotes };
    } catch (error) {
      console.error("List quotes error:", error);
      throw APIError.internal(
        `Failed to list quotes: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để lấy chi tiết một quote
export const getQuote = api(
  { method: "GET", path: "/quote/:id", expose: true },
  async (params: {
    id: string;
    authorization?: string;
  }): Promise<{ quote: Quote }> => {
    try {
      // Verify authentication
      if (
        !params.authorization ||
        !params.authorization.startsWith("Bearer ")
      ) {
        throw APIError.unauthenticated("Missing or invalid token");
      }
      const token = params.authorization.split(" ")[1];
      const auth = await verifyLogtoAuth(token);

      // Verify workspace access
      if (!auth.workspaceId) {
        throw APIError.permissionDenied("No workspace access");
      }

      const quoteService = new QuoteService();
      const quote = await quoteService.getQuoteById(params.id);

      if (!quote) {
        throw APIError.notFound("Quote not found");
      }

      // Verify workspace match
      if (quote.workspace_id !== auth.workspaceId) {
        throw APIError.permissionDenied("Workspace mismatch");
      }

      return { quote };
    } catch (error) {
      console.error("Get quote error:", error);
      throw APIError.internal(
        `Failed to get quote: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để xóa quote
export const deleteQuote = api(
  { method: "DELETE", path: "/quote/:id", expose: true },
  async (params: {
    id: string;
    authorization?: string;
  }): Promise<{ success: boolean }> => {
    try {
      // Verify authentication
      if (
        !params.authorization ||
        !params.authorization.startsWith("Bearer ")
      ) {
        throw APIError.unauthenticated("Missing or invalid token");
      }
      const token = params.authorization.split(" ")[1];
      const auth = await verifyLogtoAuth(token);

      // Verify workspace access
      if (!auth.workspaceId) {
        throw APIError.permissionDenied("No workspace access");
      }

      const quoteService = new QuoteService();
      const quote = await quoteService.getQuoteById(params.id);

      if (!quote) {
        throw APIError.notFound("Quote not found");
      }

      // Verify workspace match
      if (quote.workspace_id !== auth.workspaceId) {
        throw APIError.permissionDenied("Workspace mismatch");
      }

      // Delete quote
      await db.exec`
        DELETE FROM quotes WHERE id = ${params.id}::uuid
      `;

      return { success: true };
    } catch (error) {
      console.error("Delete quote error:", error);
      throw APIError.internal(
        `Failed to delete quote: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
