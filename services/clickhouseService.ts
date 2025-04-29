import clickhouseClient from "../config/clickhouse";

export class ClickHouseService {
  private static instance: ClickHouseService;
  private readonly tableName = "quote_analytics";

  private constructor() {}

  public static getInstance(): ClickHouseService {
    if (!ClickHouseService.instance) {
      ClickHouseService.instance = new ClickHouseService();
    }
    return ClickHouseService.instance;
  }

  public async insertQuoteEvent(event: any): Promise<void> {
    try {
      await clickhouseClient.insert({
        table: this.tableName,
        values: [event],
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error("Error inserting quote event:", error);
      throw error;
    }
  }

  public async query(sql: string): Promise<any[]> {
    try {
      const result = await clickhouseClient.query({
        query: sql,
        format: "JSONEachRow",
      });
      return await result.json();
    } catch (error) {
      console.error("Error executing query:", error);
      throw error;
    }
  }
}
