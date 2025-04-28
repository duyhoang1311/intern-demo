import { api, APIError } from "encore.dev/api";
import { db } from "../db";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { createLogtoClient, logtoConfig, sessionStorage } from "./logto-config";
import { isAdmin, verifyLogtoAuth } from "./auth";
import { URLSearchParams } from "url";
import crypto from "crypto";

const codeVerifier = crypto.randomBytes(32).toString("base64url");

const codeChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");

const SECRET_KEY = process.env.SECRET_KEY || "your-secret-key";

export interface User {
  id?: string;
  email: string;
  workspaceId: string;
}

export interface WorkspaceUserResponse {
  users: User[];
}

export const registerUser = api(
  { method: "POST", path: "/user/register", expose: true },
  async ({
    name,
    email,
    password,
    workspaceId,
  }: {
    name: string;
    email: string;
    password: string;
    workspaceId: string;
  }): Promise<User> => {
    const id = randomUUID();
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.exec`
        INSERT INTO "user" (id, name, email, password_hash, workspace_id)
        VALUES (${id}::uuid, ${name}, ${email}, ${passwordHash}, ${workspaceId}::uuid)
    `;
    return { id, email, workspaceId };
  }
);

// export const loginUser = api(
//   { method: "POST", path: "/user/login", expose: true },
//   async ({
//     email,
//     password,
//   }: {
//     email: string;
//     password: string;
//   }): Promise<{ token: string }> => {
//     const row = await db.queryRow`
//         SELECT "id", "password_hash", "workspace_id"
//         FROM "user"
//         WHERE "email" = ${email}
//       `;
//     if (!row || !bcrypt.compareSync(password, row.password_hash)) {
//       throw APIError.unauthenticated("Invalid email or password");
//     }

//     const workspaceId = row.workspace_id;
//     await db.rawExec(
//       `SELECT set_config('app.workspace_id', '${workspaceId}', false)`
//     );

//     const token = jwt.sign({ userId: row.id, role: 'admin' }, SECRET_KEY);

//     return { token };
//   }
// );

const queryParams = new URLSearchParams({
  client_id: logtoConfig.appId,
  response_type: "code",
  scope: "openid profile email",
  redirect_uri: `${
    process.env.API_URL || "http://localhost:4000"
  }/auth/callback`,
});

const redirectUrl = `${
  logtoConfig.endpoint
}/oidc/auth?${queryParams.toString()}`;

// Khởi tạo client Logto
export const login = api(
  { method: "GET", path: "/auth/login", expose: true },
  async (): Promise<{ redirect_url: string }> => {
    try {
      const logtoClient = createLogtoClient();
      const callbackUrl = `${
        process.env.API_URL || "http://localhost:4000"
      }/auth/callback`;

      // Generate state parameter for security
      const state = crypto.randomBytes(16).toString("hex");

      // Generate code verifier and challenge for PKCE
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      // Store the code verifier in session storage
      sessionStorage.set(state, { codeVerifier });

      // Build the authorization URL with all required parameters
      const queryParams = new URLSearchParams({
        client_id: logtoConfig.appId,
        response_type: "code",
        scope: (logtoConfig.scopes || ["openid", "profile", "email"]).join(" "),
        redirect_uri: callbackUrl,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "login", // Force login screen
      });

      const authUrl = `${
        logtoConfig.endpoint
      }/oidc/auth?${queryParams.toString()}`;

      return {
        redirect_url: authUrl,
      };
    } catch (error) {
      console.error("Login failed:", error);
      throw APIError.internal(
        `Login failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// Callback endpoint
export const callback = api(
  { method: "GET", path: "/auth/callback", expose: true },
  async ({
    code,
    state,
  }: {
    code?: string;
    state?: string;
  }): Promise<{ access_token: string; user_id: string }> => {
    try {
      if (!code || !state) {
        throw APIError.invalidArgument(
          "Authorization code and state are required"
        );
      }

      const logtoClient = createLogtoClient();

      // Get the stored code verifier
      const storedSession = sessionStorage.get(state);
      if (!storedSession?.codeVerifier) {
        throw APIError.invalidArgument("Invalid state parameter");
      }

      // Exchange the authorization code for tokens
      const tokenResponse = await fetch(`${logtoConfig.endpoint}/oidc/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: logtoConfig.appId,
          client_secret: logtoConfig.appSecret ?? "",
          code: code,
          redirect_uri: `${
            process.env.API_URL || "http://localhost:4000"
          }/auth/callback`,
          code_verifier: storedSession.codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }

      const tokens = (await tokenResponse.json()) as { access_token: string };

      // Store the access token
      sessionStorage.set(state, {
        ...storedSession,
        accessToken: tokens.access_token,
      });

      // Get user info
      const userInfoResponse = await fetch(`${logtoConfig.endpoint}/oidc/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        throw new Error(
          `Failed to fetch user info: ${userInfoResponse.status}`
        );
      }

      const userInfo = (await userInfoResponse.json()) as { sub: string };

      if (!userInfo.sub) {
        throw APIError.internal("Failed to get user information");
      }

      return {
        access_token: tokens.access_token,
        user_id: userInfo.sub,
      };
    } catch (error) {
      console.error("Callback error:", error);
      throw APIError.internal(
        `Authentication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

export const getUserInfo = api(
  { method: "GET", path: "/auth/userinfo", expose: true },
  async ({ token }: { token: string }) => {
    try {
      const auth = await verifyLogtoAuth(token);
      return { userId: auth.userId, roles: auth.roles, scopes: auth.scopes };
    } catch (error) {
      console.error("Get user info error:", error);
      throw APIError.unauthenticated("Invalid token");
    }
  }
);

export const logoutUser = api(
  { method: "POST", path: "/user/logout", expose: true },
  async ({ token }: { token: string }): Promise<{ success: boolean }> => {
    try {
      // Verify token first
      const auth = await verifyLogtoAuth(token);

      // Get Logto client
      const logtoClient = createLogtoClient();

      // Sign out from Logto
      await logtoClient.signOut();

      // Clear session storage
      sessionStorage.clear();

      // Reset the current workspace
      await db.rawExec(`SELECT set_config('app.workspace_id', NULL, false)`);

      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      throw APIError.internal(
        `Logout failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

export const listUsers = api(
  { method: "GET", path: "/users", expose: true },
  async (): Promise<{ users: { id: string; email: string }[] }> => {
    const rows = [];
    for await (const row of db.query`
        SELECT "id", "email"
        FROM "user"
      `) {
      rows.push({ id: row.id, email: row.email });
    }
    return { users: rows };
  }
);

export const listWorkspaceUsers = api(
  { method: "GET", path: "/workspace/users", expose: true },
  async (): Promise<WorkspaceUserResponse> => {
    const rows = [];
    for await (const row of db.query`
        SELECT id, email, workspace_id
        FROM users
      `) {
      rows.push(row);
    }

    return {
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        workspaceId: row.workspace_id,
      })),
    };
  }
);

export const listTables = api(
  { method: "GET", path: "/tables", expose: true },
  async (): Promise<{ tables: string[] }> => {
    const rows: string[] = [];
    // Dùng vòng lặp `for await` để thu thập các giá trị từ `AsyncGenerator`
    for await (const row of db.query`
      SELECT table_name::text
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `) {
      rows.push(row.table_name); // Thêm tên bảng vào mảng
    }

    return { tables: rows };
  }
);

export const deleteUserTable = api(
  { method: "DELETE", path: "/user/delete-table", expose: true },
  async (): Promise<{ message: string }> => {
    try {
      // Xóa bảng users
      await db.rawExec(`
        DROP TABLE IF EXISTS user;
      `);
      return { message: "Table 'users' has been deleted successfully." };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { message: `Error deleting table: ${error.message}` };
      } else {
        return { message: "Unknown error occurred while deleting table." };
      }
    }
  }
);

export const checkTable = api(
  { method: "GET", path: "/check-table", expose: true },
  async (): Promise<{ message: string }> => {
    // Kiểm tra xem bảng 'workspace' có tồn tại trong PostgreSQL không
    try {
      const result = await db.queryRow`
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user'
      `;

      if (result?.count > 0) {
        return { message: "Table 'workspace' exists." };
      } else {
        return { message: "Table 'workspace' does not exist." };
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { message: `Error checking table: ${error.message}` };
      } else {
        return { message: "Unknown error occurred while checking table." };
      }
    }
  }
);

export const listUserTableColumns = api(
  { method: "GET", path: "/user/columns", expose: true },
  async (): Promise<{ columns: string[] }> => {
    const columns: string[] = [];

    try {
      for await (const row of db.query`
        SELECT column_name::text AS column_name
        FROM information_schema.columns
        WHERE table_name = 'user'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `) {
        columns.push(row.column_name);
      }

      return { columns };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { columns: [`Error: ${error.message}`] };
      } else {
        return { columns: ["Unknown error occurred while fetching columns."] };
      }
    }
  }
);

// -------CHECKIN------
// Endpoint kiểm tra quyền admin
export const adminCheckin = api(
  { method: "POST", path: "/user/checkin", expose: true },
  async (params: {
    authorization?: string;
  }): Promise<{ message: string; userId: string }> => {
    if (!params.authorization || !params.authorization.startsWith("Bearer ")) {
      throw APIError.unauthenticated("Missing or invalid token");
    }

    const token = params.authorization.split(" ")[1];

    const auth = await verifyLogtoAuth(token);

    if (!isAdmin(auth)) {
      throw APIError.permissionDenied("Admin access only");
    }

    return {
      message: "Admin check-in successful",
      userId: auth.userId,
    };
  }
);
