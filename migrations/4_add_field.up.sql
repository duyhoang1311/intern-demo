CREATE TABLE "lead" (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE "lead" ENABLE ROW LEVEL SECURITY;

-- Create policy for workspace-based access
CREATE POLICY "Users can only access leads in their workspace"
  ON "lead"
  FOR ALL
  USING (workspace_id = current_setting('app.workspace_id')::uuid); 

  CREATE TABLE "application" (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL,
  position TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES lead(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE "application" ENABLE ROW LEVEL SECURITY;

-- Create policy for workspace-based access
CREATE POLICY "Users can only access applications in their workspace"
  ON "application"
  FOR ALL
  USING (workspace_id = current_setting('app.workspace_id')::uuid); 


  CREATE TABLE "offer" (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL,
  salary DECIMAL(10,2) NOT NULL,
  benefits TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE "offer" ENABLE ROW LEVEL SECURITY;

-- Create policy for workspace-based access
CREATE POLICY "Users can only access offers in their workspace"
  ON "offer"
  FOR ALL
  USING (workspace_id = current_setting('app.workspace_id')::uuid); 