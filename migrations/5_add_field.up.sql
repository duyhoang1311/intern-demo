CREATE TABLE "quotes" (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  offer_id UUID NOT NULL,
  created_by TEXT NOT NULL,
  price FLOAT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP,
  converted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES lead(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offer(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;

-- Create policy for workspace-based access
CREATE POLICY "Users can only access quotes in their workspace"
  ON "quotes"
  FOR ALL
  USING (workspace_id = current_setting('app.workspace_id')::uuid); 