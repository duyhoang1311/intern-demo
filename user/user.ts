import { api, APIError } from "encore.dev/api";
import { db } from "../db";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { createLogtoClient, logtoConfig } from "./logto-config";
import { isAdmin, verifyLogtoAuth } from "./auth";
import { URLSearchParams } from "url";
import crypto from 'crypto';

const codeVerifier = crypto.randomBytes(32).toString('base64url');

const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

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
  response_type: 'code',
  scope: 'openid profile email',
  redirect_uri: `${process.env.API_URL || 'http://localhost:4000'}/auth/callback`,
});

const redirectUrl = `${logtoConfig.endpoint}/oidc/auth?${queryParams.toString()}`;


// Khởi tạo client Logto
// export const login = api(
//   { method: "GET", path: "/auth/login", expose: true },
//   async (): Promise<{ redirect_url: string }> => {
//       try {
//           const logtoClient = createLogtoClient();
//           const callbackUrl = `${process.env.API_URL || 'http://localhost:4000'}/auth/callback`;
          
//           console.log('Starting login flow with config:', {
//               endpoint: logtoConfig.endpoint,
//               appId: logtoConfig.appId,
//               configuredScopes: logtoConfig.scopes,
//               resources: logtoConfig.resources
//           });
          
//           // Check if we already have a valid session
//           try {
//               const context = await logtoClient.getContext();
//               console.log('Existing context:', context);
//               if (context.isAuthenticated) {
//                   // If we have a valid session, return the current access token
//                   const accessToken = await logtoClient.getAccessToken();
//                   console.log('Existing access token:', accessToken);
//                   return {
//                       redirect_url: `${process.env.API_URL || 'http://localhost:4000'}/auth/callback?token=${accessToken}`
//                   };
//               }
//           } catch (error) {
//               // If getContext fails, we need to start a new login flow
//               console.log('No valid session found, starting new login flow');
//           }
          
//           // Initiate the sign-in flow and return the callback URL
//           await logtoClient.signIn(callbackUrl);
//           return {
//               redirect_url: callbackUrl
//           };
//       } catch (error) {
//           console.error('Login failed:', error);
//           throw APIError.internal(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       }
//   }
// );

export const login = api(
  { method: "GET", path: "/auth/login", expose: true },
  async (): Promise<{ redirect_url: string }> => {
    const params = new URLSearchParams({
      client_id: logtoConfig.appId,
      redirect_uri: `${process.env.API_URL || 'http://localhost:4000'}/auth/callback`,
      response_type: 'code',
      scope: 'openid offline_access',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',  // Phương thức mã hóa SHA256
    });

    const authorizationUrl = `${logtoConfig.endpoint}/oidc/auth?${params.toString()}`;

    return { redirect_url: authorizationUrl };
  }
);

// Callback endpoint
export const callback = api(
  { method: "GET", path: "/auth/callback", expose: true },
  async ({ code, state }: { code?: string, state?: string }): Promise<{ access_token: string; user_id: string }> => {
      try {
          if (!code) {
              throw APIError.invalidArgument("Authorization code is required");
          }

          const logtoClient = createLogtoClient();
          console.log('Processing callback with code:', code);
          
          try {
              // Handle the callback and exchange code for tokens
              await logtoClient.handleSignInCallback(`${process.env.API_URL || 'http://localhost:4000'}/auth/callback?code=${code}&state=${state || ''}`);
              
              // Get and log token information
              const accessToken = await logtoClient.getAccessToken();
              const idToken = await logtoClient.getIdToken();
              
              console.log('Tokens received:', {
                  accessToken,
                  idToken
              });
              
              // Try to decode tokens
              for (const [tokenName, token] of [['Access Token', accessToken], ['ID Token', idToken]]) {
                  if (token) {
                      try {
                          const [, payload] = token.split('.');
                          if (payload) {
                              const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
                              console.log(`${tokenName} payload:`, decodedPayload);
                          }
                      } catch (error) {
                          console.log(`Error decoding ${tokenName}:`, error);
                      }
                  }
              }
          } catch (error) {
              // If session not found, redirect to login
              if (error instanceof Error && error.message.includes('Sign-in session not found')) {
                  await logtoClient.signIn(`${process.env.API_URL || 'http://localhost:4000'}/auth/callback`);
                  throw APIError.unauthenticated("Session expired, please login again");
              }
              throw error;
          }
          
          // Get user info after successful sign-in
          const userInfo = await logtoClient.fetchUserInfo();
          console.log('User info:', userInfo);

          if (!userInfo.sub) {
              throw APIError.internal("Failed to get user information");
          }

          // Get access token
          const accessToken = await logtoClient.getAccessToken();

          return { 
              access_token: accessToken,
              user_id: userInfo.sub
          };
      } catch (error) {
          console.error("Callback error:", error);
          throw APIError.internal(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  async (): Promise<{ success: boolean }> => {
    // Reset the current workspace
    await db.rawExec(`SELECT set_config('app.workspace_id', NULL, false)`);
    return { success: true };
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
  async (params: { authorization?: string }): Promise<{ message: string; userId: string }> => {
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