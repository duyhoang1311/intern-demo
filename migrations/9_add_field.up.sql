CREATE TABLE quote_analytics (
  id VARCHAR(255) PRIMARY KEY,
  quote_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  workspace_id VARCHAR(255) NOT NULL
);

CREATE INDEX idx_quote_analytics_quote_id ON quote_analytics(quote_id);
CREATE INDEX idx_quote_analytics_created_at ON quote_analytics(created_at);