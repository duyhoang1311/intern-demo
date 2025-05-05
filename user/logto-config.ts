import LogtoClient from "@logto/node";

// Cấu hình kết nối với Logto
export const logtoConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || "https://vwal09.logto.app",
  appId: process.env.LOGTO_APP_ID || "36ljq4yaob83uz2j7cmb4",
  appSecret: process.env.LOGTO_APP_SECRET || "pJN43JmnPQytQLc6NU9zEorSPZqyHZKl",
  baseUrl: process.env.BASE_URL || "https://demo-1-p9ai.encore.app",
  cookieSecret: process.env.COOKIE_SECRET || "your-cookie-secret",
  cookieSecure: process.env.NODE_ENV === "production",
  scopes: ["openid", "profile", "email", "offline_access"],
  resources: [process.env.BASE_URL || "https://demo-1-p9ai.encore.app"],
  postLogoutRedirectUri: `${
    process.env.BASE_URL || "https://demo-1-p9ai.encore.app"
  }/auth/callback`,
  callbackUri: `${
    process.env.BASE_URL || "https://demo-1-p9ai.encore.app"
  }/auth/callback`,
};

interface SessionData {
  codeVerifier: string;
  accessToken?: string;
  workspaceId?: string;
}

export const sessionStorage = new Map<string, SessionData>();

export function createLogtoClient() {
  return new LogtoClient(logtoConfig, {
    navigate: (url: string) => {
      console.log("Navigation requested to:", url);
    },
    storage: {
      getItem: async (key: string) =>
        sessionStorage.get(key)?.codeVerifier || null,
      setItem: async (key: string, value: string) => {
        sessionStorage.set(key, { codeVerifier: value });
      },
      removeItem: async (key: string) => {
        sessionStorage.delete(key);
      },
    },
  });
}
