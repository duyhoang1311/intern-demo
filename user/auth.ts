import { APIError } from "encore.dev/api";
import { createLogtoClient, logtoConfig } from "../user/logto-config";

interface AuthContext {
  userId: string;
  roles: string[];
  scopes: string[];
}

interface UserInfo {
  sub: string;
  name?: string | null;
  email?: string;
  [key: string]: unknown;
}

interface TokenInfo {
  active: boolean;
  scope?: string;
  role?: { name: string }[];
  [key: string]: unknown;
}

export async function verifyLogtoAuth(token: string): Promise<AuthContext> {
  try {
    const logtoClient = createLogtoClient();
    const baseUrl = logtoConfig.endpoint.replace(/\/$/, "");

    // Introspect token
    const params = new URLSearchParams();
    params.append("client_id", logtoConfig.appId);
    if (logtoConfig.appSecret) {
      params.append("client_secret", logtoConfig.appSecret);
    }
    params.append("token", token);

    const tokenInfoResponse = await fetch(
      `${baseUrl}/oidc/token/introspection`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    if (!tokenInfoResponse.ok) {
      throw new Error(
        `Failed to introspect token: ${tokenInfoResponse.status}`
      );
    }

    const tokenInfo = (await tokenInfoResponse.json()) as TokenInfo;

    if (!tokenInfo.active) {
      throw new Error("Token is not active");
    }

    // Get user info
    const userInfoResponse = await fetch(`${baseUrl}/oidc/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error(`Failed to fetch user info: ${userInfoResponse.status}`);
    }

    const userInfo = (await userInfoResponse.json()) as UserInfo;

    if (!userInfo.sub) {
      throw new Error("No user ID in response");
    }

    // Get roles from user info
    const roles = (userInfo.roles as string[]) || [];
    const scopes =
      typeof tokenInfo.scope === "string" ? tokenInfo.scope.split(" ") : [];

    return {
      userId: userInfo.sub,
      roles,
      scopes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw APIError.unauthenticated(`Invalid token: ${msg}`);
  }
}

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
