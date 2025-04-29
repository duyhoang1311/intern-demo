import { api, APIError } from "encore.dev/api";
import { verifyLogtoAuth } from "../user/auth";
import { ClickHouseService } from "../services/clickhouseService";

// API endpoint để lấy tỷ lệ chuyển đổi quotes
export const getQuoteConversionRate = api(
  { method: "GET", path: "/stats/quote-rate", expose: true },
  async (params: {
    workspaceId: string;
    startDate: string;
    endDate: string;
    authorization?: string;
  }): Promise<{
    total_quotes: number;
    converted_quotes: number;
    conversion_rate: number;
    average_time_to_convert: number;
  }> => {
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

      // Verify workspace match
      if (params.workspaceId !== auth.workspaceId) {
        throw APIError.permissionDenied("Workspace mismatch");
      }

      const clickhouseService = ClickHouseService.getInstance();
      const result = await clickhouseService.query(`
        SELECT
          count() as total_quotes,
          countIf(event_type = 'converted') as converted_quotes,
          round(countIf(event_type = 'converted') / count() * 100, 2) as conversion_rate,
          round(avgIf(
            dateDiff('second', 
              (SELECT created_at FROM quote_analytics WHERE quote_id = qa.quote_id AND event_type = 'created' LIMIT 1),
              created_at
            ),
            event_type = 'converted'
          ) / 3600, 2) as average_time_to_convert
        FROM quote_analytics qa
        WHERE workspace_id = '${params.workspaceId}'
        AND created_at >= '${params.startDate}'
        AND created_at <= '${params.endDate}'
      `);

      return result[0];
    } catch (error) {
      console.error("Get quote conversion rate error:", error);
      throw APIError.internal(
        `Failed to get quote conversion rate: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để lấy thống kê chi tiết của workspace
export const getWorkspaceStats = api(
  { method: "GET", path: "/stats/workspace/:workspaceId", expose: true },
  async (params: {
    workspaceId: string;
    authorization?: string;
  }): Promise<{
    total_quotes: number;
    converted_quotes: number;
    conversion_rate: number;
    quotes_by_status: Record<string, number>;
    quotes_by_user: Record<string, number>;
    average_quote_value: number;
    total_revenue: number;
  }> => {
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

      // Verify workspace match
      if (params.workspaceId !== auth.workspaceId) {
        throw APIError.permissionDenied("Workspace mismatch");
      }

      const clickhouseService = ClickHouseService.getInstance();
      const result = await clickhouseService.query(`
        WITH quote_events AS (
          SELECT
            quote_id,
            argMax(event_type, created_at) as last_status,
            argMax(user_id, created_at) as last_user,
            argMax(JSONExtractFloat(event_data, 'amount'), created_at) as amount
          FROM quote_analytics
          WHERE workspace_id = '${params.workspaceId}'
          GROUP BY quote_id
        )
        SELECT
          count() as total_quotes,
          countIf(last_status = 'converted') as converted_quotes,
          round(countIf(last_status = 'converted') / count() * 100, 2) as conversion_rate,
          map(
            arrayMap(x -> x.1, groupArray((last_status, count()))),
            arrayMap(x -> x.2, groupArray((last_status, count())))
          ) as quotes_by_status,
          map(
            arrayMap(x -> x.1, groupArray((last_user, count()))),
            arrayMap(x -> x.2, groupArray((last_user, count())))
          ) as quotes_by_user,
          round(avg(amount), 2) as average_quote_value,
          round(sumIf(amount, last_status = 'converted'), 2) as total_revenue
        FROM quote_events
      `);

      return result[0];
    } catch (error) {
      console.error("Get workspace stats error:", error);
      throw APIError.internal(
        `Failed to get workspace stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để lấy thống kê theo thời gian
export const getTimeSeriesStats = api(
  { method: "GET", path: "/stats/time-series", expose: true },
  async (params: {
    workspaceId: string;
    startDate: string;
    endDate: string;
    interval: "day" | "week" | "month";
    authorization?: string;
  }): Promise<{
    time_series: Array<{
      date: string;
      total_quotes: number;
      converted_quotes: number;
      conversion_rate: number;
      total_revenue: number;
    }>;
  }> => {
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

      // Verify workspace match
      if (params.workspaceId !== auth.workspaceId) {
        throw APIError.permissionDenied("Workspace mismatch");
      }

      const clickhouseService = ClickHouseService.getInstance();
      const result = await clickhouseService.query(`
        WITH quote_events AS (
          SELECT
            quote_id,
            toStartOfInterval(created_at, INTERVAL 1 ${params.interval}) as date,
            argMax(event_type, created_at) as last_status,
            argMax(JSONExtractFloat(event_data, 'amount'), created_at) as amount
          FROM quote_analytics
          WHERE workspace_id = '${params.workspaceId}'
          AND created_at >= '${params.startDate}'
          AND created_at <= '${params.endDate}'
          GROUP BY quote_id, date
        )
        SELECT
          date,
          count() as total_quotes,
          countIf(last_status = 'converted') as converted_quotes,
          round(countIf(last_status = 'converted') / count() * 100, 2) as conversion_rate,
          round(sumIf(amount, last_status = 'converted'), 2) as total_revenue
        FROM quote_events
        GROUP BY date
        ORDER BY date
      `);

      return { time_series: result };
    } catch (error) {
      console.error("Get time series stats error:", error);
      throw APIError.internal(
        `Failed to get time series stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để theo dõi các event của quote theo thời gian thực
export const getQuoteEvents = api(
  { method: "GET", path: "/stats/quote/:quoteId/events", expose: true },
  async (params: {
    quoteId: string;
    authorization?: string;
  }): Promise<{
    events: Array<{
      id: string;
      event_type: string;
      event_data: any;
      created_at: string;
      user_id: string;
    }>;
  }> => {
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

      const clickhouseService = ClickHouseService.getInstance();
      const result = await clickhouseService.query(`
        SELECT
          id,
          event_type,
          event_data,
          created_at,
          user_id
        FROM quote_analytics
        WHERE quote_id = '${params.quoteId}'
        AND workspace_id = '${auth.workspaceId}'
        ORDER BY created_at DESC
      `);

      return { events: result };
    } catch (error) {
      console.error("Get quote events error:", error);
      throw APIError.internal(
        `Failed to get quote events: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
