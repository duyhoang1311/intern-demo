import { APIError, api } from "encore.dev/api";
import {
  createLogtoClient,
  logtoConfig,
  sessionStorage,
} from "../user/logto-config";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

export interface AuthContext {
  userId: string;
  email: string;
  workspaceId: string;
  roles: string[];
  scopes: string[];
}

interface UserInfo {
  sub: string;
  name?: string | null;
  email?: string;
  workspace_id?: string;
  organization_id?: string;
  roles?: string[];
  [key: string]: unknown;
}

interface TokenInfo {
  active: boolean;
  scope?: string;
  [key: string]: unknown;
}

export async function verifyLogtoAuth(token: string): Promise<AuthContext> {
  try {
    const logtoClient = createLogtoClient();
    const baseUrl = logtoConfig.endpoint.replace(/\/$/, "");

    // Get user info
    const userInfoResponse = await fetch(`${baseUrl}/oidc/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      throw new Error(
        `Failed to fetch user info: ${userInfoResponse.status} - ${errorText}`
      );
    }

    const userInfo = (await userInfoResponse.json()) as UserInfo;

    if (!userInfo.sub) {
      throw new Error("No user ID in response");
    }

    // Lấy workspace_id từ session storage hoặc từ userInfo
    const session = sessionStorage.get(token);
    const workspaceId = session?.workspaceId || userInfo.workspace_id || "";

    if (!workspaceId) {
      throw new Error("No workspace ID found in session or user info");
    }

    return {
      userId: userInfo.sub,
      email: userInfo.email || "",
      workspaceId,
      roles: userInfo.roles || [],
      scopes: [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw APIError.unauthenticated(`Invalid token: ${msg}`);
  }
}

// API endpoint để xử lý callback từ Logto
export const handleAuthCallback = api(
  { method: "GET", path: "/auth/callback", expose: true },
  async (params: {
    code: string;
    state: string;
  }): Promise<{ success: boolean; access_token: string; user_id: string }> => {
    try {
      const logtoClient = createLogtoClient();
      const baseUrl = logtoConfig.endpoint.replace(/\/$/, "");

      // Lấy code_verifier từ session storage
      const session = sessionStorage.get(params.state);
      if (!session?.codeVerifier) {
        throw new Error("Invalid state parameter");
      }

      // Exchange code for token
      const tokenResponse = await fetch(`${baseUrl}/oidc/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: logtoConfig.appId,
          client_secret: logtoConfig.appSecret,
          code: params.code,
          redirect_uri: logtoConfig.callbackUri,
          code_verifier: session.codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(
          `Failed to get token: ${tokenResponse.status} - ${JSON.stringify(
            error
          )}`
        );
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };
      const { access_token } = tokenData;

      if (!access_token) {
        throw new Error("No access token in response");
      }

      // Get user info
      const userInfoResponse = await fetch(`${baseUrl}/oidc/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!userInfoResponse.ok) {
        throw new Error(`Failed to get user info: ${userInfoResponse.status}`);
      }

      const userInfo = (await userInfoResponse.json()) as UserInfo;

      if (!userInfo.sub) {
        throw new Error("No user ID in response");
      }

      // Store token in session
      sessionStorage.set(access_token, {
        codeVerifier: params.state,
        accessToken: access_token,
      });

      return {
        success: true,
        access_token,
        user_id: userInfo.sub,
      };
    } catch (error) {
      console.error("Auth callback error:", error);
      throw APIError.internal(
        `Authentication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

export function isAdmin(auth: AuthContext): boolean {
  return auth.roles.includes("admin");
}

export function checkRoles(auth: AuthContext, requiredRoles: string[]): void {
  if (!requiredRoles.some((r) => auth.roles.includes(r))) {
    throw APIError.permissionDenied("Insufficient role permissions");
  }
}

export function checkScopes(auth: AuthContext, requiredScopes: string[]): void {
  const resourcePrefix = "http://localhost:4000/";
  const fullScopes = requiredScopes.map((s) =>
    s.startsWith(resourcePrefix) ? s : resourcePrefix + s
  );

  const missing = fullScopes.filter((s) => !auth.scopes.includes(s));
  if (missing.length > 0) {
    throw APIError.permissionDenied(
      `Missing required scopes: ${missing.join(", ")}`
    );
  }
}

// Hàm tạo code challenge từ code verifier
function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// API endpoint để bắt đầu đăng nhập qua Logto
export const login = api(
  { method: "GET", path: "/auth/login", expose: true },
  async (): Promise<{ url: string }> => {
    try {
      // Tạo code_verifier ngẫu nhiên với độ dài 43-128 ký tự
      const codeVerifier = randomUUID() + randomUUID() + randomUUID();

      // Tạo code challenge từ code verifier
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Tạo state ngẫu nhiên
      const state = randomUUID();

      // Lưu code_verifier vào session storage
      sessionStorage.set(state, { codeVerifier });

      // Tạo URL đăng nhập
      const baseUrl = logtoConfig.endpoint.replace(/\/$/, "");
      const signInUrl =
        `${baseUrl}/oidc/auth?` +
        new URLSearchParams({
          client_id: logtoConfig.appId,
          redirect_uri: logtoConfig.callbackUri,
          response_type: "code",
          scope: logtoConfig.scopes.join(" "),
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        }).toString();

      return { url: signInUrl };
    } catch (error) {
      console.error("Login error:", error);
      throw APIError.internal(
        `Failed to initiate login: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để cập nhật workspace_id
export const updateWorkspaceId = api(
  { method: "POST", path: "/auth/workspace/update", expose: true },
  async (params: {
    authorization?: string;
    workspace_id: string;
  }): Promise<{ success: boolean }> => {
    try {
      if (
        !params.authorization ||
        !params.authorization.startsWith("Bearer ")
      ) {
        throw APIError.unauthenticated("Missing or invalid token");
      }

      const token = params.authorization.split(" ")[1];

      // Lưu workspace_id vào session storage
      const session = sessionStorage.get(token);
      if (session) {
        sessionStorage.set(token, {
          ...session,
          workspaceId: params.workspace_id,
        });
      } else {
        sessionStorage.set(token, {
          codeVerifier: token,
          workspaceId: params.workspace_id,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Update workspace error:", error);
      throw APIError.internal(
        `Failed to update workspace: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

// API endpoint để lấy thông tin user
export const getAuthUserInfo = api(
  { method: "GET", path: "/auth/user/info", expose: true },
  async (params: { authorization?: string }): Promise<AuthContext> => {
    try {
      if (
        !params.authorization ||
        !params.authorization.startsWith("Bearer ")
      ) {
        throw APIError.unauthenticated("Missing or invalid token");
      }

      const token = params.authorization.split(" ")[1];
      const baseUrl = logtoConfig.endpoint.replace(/\/$/, "");

      // Get user info directly from Logto
      const userInfoResponse = await fetch(`${baseUrl}/oidc/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userInfoResponse.ok) {
        throw new Error(`Failed to get user info: ${userInfoResponse.status}`);
      }

      const userInfo = (await userInfoResponse.json()) as UserInfo;

      if (!userInfo.sub) {
        throw new Error("No user ID in response");
      }

      // Lấy workspace_id từ session storage
      const session = sessionStorage.get(token);
      const workspaceId = session?.workspaceId || "";

      return {
        userId: userInfo.sub,
        email: userInfo.email || "",
        workspaceId,
        roles: userInfo.roles || [],
        scopes: [],
      };
    } catch (error) {
      console.error("Get user info error:", error);
      throw APIError.internal(
        `Failed to get user info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
