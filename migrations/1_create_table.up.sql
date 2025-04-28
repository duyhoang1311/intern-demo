CREATE TABLE workspace (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE plan (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  plan_name VARCHAR(255) NOT NULL
);

ALTER TABLE plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_isolation_policy
  ON plan
  USING (workspace_id::text = current_setting('app.workspace_id'));

ALTER TABLE plan FORCE ROW LEVEL SECURITY;