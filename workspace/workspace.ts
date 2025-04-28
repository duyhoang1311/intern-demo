import { db } from "../db";
import { api } from "encore.dev/api";
import { randomUUID } from "node:crypto";

export interface Workspace {
  id: string; // Unique identifier for the workspace
  name: string; // Name of the workspace
}

export interface WorkspaceListResponse {
    workspaces: Workspace[];
}

export interface CurrentWorkspaceResponse {
    workspace: Workspace | null;
}

// Create a new workspace
export const createWorkspace = api(
  { method: "POST", path: "/workspace", expose: true },
  async ({ name }: { name: string }): Promise<Workspace> => {
    const id = randomUUID();
    await db.exec`
      INSERT INTO workspace (id, name)
      VALUES (${id}, ${name})
    `;
    return { id, name };
  }
);

// List all workspaces
export const listWorkspaces = api(
  { method: "GET", path: "/workspaces", expose: true },
  async (): Promise<WorkspaceListResponse> => {
    const rows = [];
    for await (const row of db.query`
      SELECT id, name
      FROM workspace
    `) {
      rows.push(row);
    }
    return { workspaces: rows.map((row) => ({ id: row.id, name: row.name })) };
  }
);

export const setWorkspace = api(
    { method: "POST", path: "/workspace/set", expose: true },
    async ({ workspaceId }: { workspaceId: string }): Promise<{ success: boolean }> => {
        // Validate that the workspace exists
        const row = await db.queryRow`
            SELECT id FROM workspace WHERE id = ${workspaceId}
        `;
        if (!row) {
            throw new Error(`Workspace with ID ${workspaceId} not found`);
        }

        await db.rawExec(`SELECT set_config('app.workspace_id', '${workspaceId}', false)`);
        return { success: true };
    }
  );

export const getWorkspace = api(
    { method: "GET", path: "/workspace/:id", expose: true },


    async ({ id }: { id: string }): Promise<Workspace> => {
      const row = await db.queryRow`
        SELECT id, name
        FROM workspace
        WHERE id = ${id}
      `;
      if (!row) {
        throw new Error(`Workspace with ID ${id} not found`);
      }
      return { id: row.id, name: row.name };
    }
);

export const getCurrentWorkspace = api(
    { method: "GET", path: "/workspace/current", expose: true },
    async (): Promise<CurrentWorkspaceResponse> => {
      // Retrieve the current workspace ID from the session variable
      const currentId = await db.queryRow`
        SELECT current_setting('app.workspace_id', true) as current_workspace_id
      `;
  
      if (!currentId?.current_workspace_id) {
        // If no workspace ID is set, return null
        return { workspace: null };
      }
  
      // Fetch the workspace details using the current workspace ID
      const workspace = await db.queryRow`
        SELECT id, name
        FROM workspace
        WHERE id = ${currentId.current_workspace_id}::uuid
      `;
  
      if (!workspace) {
        // If the workspace does not exist, return null
        return { workspace: null };
      }
  
      // Return the workspace details
      return {
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
      };
    }
);