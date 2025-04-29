import { createClient } from "@clickhouse/client";

const clickhouseClient = createClient({
  host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "password",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

export default clickhouseClient;
