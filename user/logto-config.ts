import LogtoClient from "@logto/node";
import { LogtoConfig } from "@logto/node";

// Cấu hình kết nối với Logto
export const logtoConfig: LogtoConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || "https://vwal09.logto.app/", // URL endpoint của Logto
  appId: process.env.LOGTO_APP_ID || "36ljq4yaob83uz2j7cmb4", // App ID được cấp khi đăng ký ứng dụng với Logto
  appSecret: process.env.LOGTO_APP_SECRET || "pJN43JmnPQytQLc6NU9zEorSPZqyHZKl", // App Secret tương ứng
  scopes: [
    "openid",
    "profile",
    "email",
    "http://127.0.0.1:4000/read:resource",
    "http://127.0.0.1:4000/write:resource",
    "roles",
  ],
  resources: ["http://localhost:4000"],
};

export const sessionStorage = new Map<
  string,
  { codeVerifier: string; accessToken?: string }
>();

export const createLogtoClient = () =>
  new LogtoClient(logtoConfig, {
    navigate: (url: string) => {
      console.log("logtoConfig: ", logtoConfig);
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
