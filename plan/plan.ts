import { db } from "../db";
import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { isAdmin, verifyLogtoAuth } from "../user/auth";
import { JWTSimulator } from "../middleware";

export interface Plan {
  id: string; // Unique identifier for the plan
  workspaceId: string; // Identifier for the associated workspace
  planName: string; // Name of the plan, up to 255 characters
}

export interface PlanListResponse {
  plans: Plan[];
}

export const createPlan = api(
  { method: "POST", path: "/plan", expose: true },
  async ({ planName, token }: { planName: string, token: string }): Promise<Plan> => {
    const auth = await verifyLogtoAuth(token);
    if (!isAdmin(auth)) {
      throw APIError.permissionDenied("Only admins can create plans");
    }
    console.log('User is admin:', true);

    const id = randomUUID();
    const currentWorkspaceId = await db.queryRow`
      SELECT current_setting('app.workspace_id', true) as workspace_id
    `;
    
    if (!currentWorkspaceId?.workspace_id) {
      throw APIError.invalidArgument("No workspace selected");
    }

    await db.exec`
      INSERT INTO plan (id, workspace_id, plan_name)
      VALUES (${id}, (current_setting('app.workspace_id'))::uuid, ${planName})
    `;
    return { id, workspaceId: currentWorkspaceId.workspace_id, planName };
  }
);
export const checkPlanTable = api(
  { method: "GET", path: "/check-plan-table", expose: true },
  async (): Promise<{ message: string }> => {
    try {
      // Kiểm tra xem bảng 'plan' có tồn tại không
      const tableExists = await db.queryRow`
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'plan'
      `;

      if (tableExists?.count === '0') {
        return { message: "Table 'plan' does not exist." };
      }

      // Kiểm tra cấu trúc bảng 'plan' và xác minh cột 'id'
      const columnExists = await db.queryRow`
        SELECT COUNT(*) 
        FROM information_schema.columns 
        WHERE table_name = 'plan' 
        AND column_name = 'id'
      `;

      if (columnExists?.count === '0') {
        return { message: "Column 'id' does not exist in 'plan' table." };
      }

      // Kiểm tra kiểu dữ liệu của cột 'id'
      const columnType = await db.queryRow`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'plan' 
        AND column_name = 'id'
      `;

      if (columnType?.data_type !== 'uuid') {
        return { message: "Column 'id' is not of type 'uuid' in 'plan' table." };
      }

      return { message: "Table 'plan' exists and column 'id' is of type 'uuid'." };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { message: `Error checking table: ${error.message}` };
      } else {
        return { message: "Unknown error occurred while checking table." };
      }
    }
  }
);

export const getPlan = api(
  { method: "GET", path: "/plan/:id", expose: true },
  async ({ id, token }: { id: string; token: string }): Promise<Plan> => {
    const user = await JWTSimulator.getUserFromToken(token);
    if (!user) {
      throw APIError.unauthenticated("Invalid or expired token");
    }

    const row = await db.queryRow`
      SELECT id, workspace_id, plan_name
      FROM plan
      WHERE id = ${id}
    `;
    if (!row) {
      throw APIError.notFound(`Plan with ID ${id} not found`);
    }
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      planName: row.plan_name,
    };
  }
);

export const listPlans = api(
  { method: "GET", path: "/plans", expose: true },
  async ({ token }: { token: string }): Promise<PlanListResponse> => {
    const user = await JWTSimulator.getUserFromToken(token);
    if (!user) {
      throw APIError.unauthenticated("Invalid or expired token");
    }

    const rows = [];
    for await (const row of db.query`
      SELECT id, workspace_id, plan_name
      FROM plan
    `) {
      rows.push(row);
    }
    return {
      plans: rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        planName: row.plan_name,
      })),
    };
  }
);


export const ping = api(
  { method: "GET", path: "/ping", expose: true },
  async (): Promise<{ message: string }> => {
    return { message: "pong from plan service" };
  }
);

