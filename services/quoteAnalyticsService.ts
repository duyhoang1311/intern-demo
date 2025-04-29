import clickhouseClient from "../config/clickhouse";
import { randomUUID } from "node:crypto";
import { ClickHouseService } from "./clickhouseService";

export interface QuoteEvent {
  quote_id: string;
  event_type: string;
  event_data: {
    amount: number;
    currency: string;
  };
  created_at: string;
  user_id: string;
}

export interface QuoteAnalytics {
  id: string;
  tenant_id: string;
  quote_id: string;
  event_type: string;
  event_data: string;
  created_at: string;
  user_id: string;
  metadata: string | null;
}

interface ConversionRateResult {
  total_quotes: number;
  converted_quotes: number;
  conversion_rate: number;
}

interface TenantStatsResult {
  total_quotes: number;
  converted_quotes: number;
  conversion_rate: number;
  quotes_by_type: Record<string, number>;
}

export class QuoteAnalyticsService {
  private readonly tableName = "quote_analytics";
  private clickhouseService: ClickHouseService;

  constructor() {
    this.clickhouseService = ClickHouseService.getInstance();
  }

  public async trackQuoteEvent(
    event: {
      quote_id: string;
      event_type: string;
      event_data: {
        amount: number;
        currency: string;
      };
      created_at: string;
      user_id: string;
    },
    userId: string,
    workspaceId: string
  ): Promise<void> {
    await this.clickhouseService.insertQuoteEvent({
      ...event,
      id: randomUUID(),
      user_id: userId,
      workspace_id: workspaceId,
      event_data: JSON.stringify(event.event_data),
      created_at: new Date(event.created_at),
    });
  }

  async getQuoteConversionRate(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ConversionRateResult> {
    try {
      const result = await clickhouseClient.query({
        query: `
          SELECT
            count() as total_quotes,
            countIf(event_type = 'converted') as converted_quotes,
            round(countIf(event_type = 'converted') / count() * 100, 2) as conversion_rate
          FROM ${this.tableName}
          WHERE tenant_id = {tenantId:String}
          AND created_at >= {startDate:DateTime}
          AND created_at <= {endDate:DateTime}
        `,
        query_params: {
          tenantId,
          startDate,
          endDate,
        },
      });

      const rows = (await result.json()) as unknown as ConversionRateResult[];
      return rows[0];
    } catch (error) {
      console.error("Error getting quote conversion rate:", error);
      throw error;
    }
  }

  async getTenantStats(tenantId: string): Promise<TenantStatsResult> {
    try {
      const result = await clickhouseClient.query({
        query: `
          SELECT
            count() as total_quotes,
            countIf(event_type = 'converted') as converted_quotes,
            round(countIf(event_type = 'converted') / count() * 100, 2) as conversion_rate,
            groupArray((event_type, count())) as quotes_by_type
          FROM ${this.tableName}
          WHERE tenant_id = {tenantId:String}
          GROUP BY tenant_id
        `,
        query_params: {
          tenantId,
        },
      });

      const rows = (await result.json()) as unknown as TenantStatsResult[];
      return rows[0];
    } catch (error) {
      console.error("Error getting tenant stats:", error);
      throw error;
    }
  }
}
