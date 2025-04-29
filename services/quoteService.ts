import { db } from "../db";

export class QuoteService {
  async createQuote(quote: {
    id: string;
    workspace_id: string;
    lead_id: string;
    offer_id: string;
    created_by: string;
    price: number;
    status?: string;
    sent_at?: Date;
    converted_at?: Date;
    created_at?: Date;
  }): Promise<void> {
    try {
      await db.exec`
        INSERT INTO quotes (
          id, workspace_id, lead_id, offer_id, created_by, 
          price, status, sent_at, converted_at, created_at
        )
        VALUES (
          ${quote.id}::uuid, ${quote.workspace_id}::uuid, ${
        quote.lead_id
      }::uuid, 
          ${quote.offer_id}::uuid, ${quote.created_by}, ${quote.price},
          ${quote.status || "sent"}, ${quote.sent_at}, ${quote.converted_at},
          ${quote.created_at || new Date()}
        )
      `;
    } catch (error) {
      console.error("Error creating quote:", error);
      throw error;
    }
  }

  async getQuoteById(id: string): Promise<any> {
    try {
      const quote = await db.queryRow`
        SELECT * FROM quotes WHERE id = ${id}::uuid
      `;
      return quote;
    } catch (error) {
      console.error("Error getting quote:", error);
      throw error;
    }
  }

  async getQuotesByWorkspace(workspace_id: string): Promise<any[]> {
    try {
      const quotes = [];
      for await (const row of db.query`
        SELECT * FROM quotes 
        WHERE workspace_id = ${workspace_id}::uuid 
        ORDER BY created_at DESC
      `) {
        quotes.push(row);
      }
      return quotes;
    } catch (error) {
      console.error("Error getting quotes:", error);
      throw error;
    }
  }
}
