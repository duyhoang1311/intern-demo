import { createClient } from "@clickhouse/client";

const client = createClient({
  host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "password",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

async function createTables() {
  try {
    // Create database if not exists
    await client.query({
      query: `CREATE DATABASE IF NOT EXISTS ${
        process.env.CLICKHOUSE_DATABASE || "default"
      }`,
    });

    // Create quote_analytics table
    await client.query({
      query: `
        CREATE TABLE IF NOT EXISTS quote_analytics (
          id String,
          quote_id String,
          event_type String,
          event_data String,
          created_at DateTime,
          user_id String,
          workspace_id String
        ) ENGINE = MergeTree()
        ORDER BY (quote_id, created_at)
      `,
    });

    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  } finally {
    await client.close();
  }
}

createTables().catch(console.error);
