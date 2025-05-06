CREATE TABLE insight (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


ALTER TABLE insight ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON insight
  USING (workspace_id::text = current_setting('app.workspace_id'));
