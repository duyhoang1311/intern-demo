import LogtoClient from '@logto/node';
import {LogtoConfig} from '@logto/node';

// Cấu hình kết nối với Logto
export const logtoConfig : LogtoConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || 'https://vwal09.logto.app',  // URL endpoint của Logto
  appId: process.env.LOGTO_APP_ID || '33569v7205q5wj8dtl1nu',                        // App ID được cấp khi đăng ký ứng dụng với Logto
  appSecret: process.env.LOGTO_APP_SECRET || 'OZFikdxR8ikAnMKsDeNRfyuONGzrPD7j',             // App Secret tương ứng
  resources: ['http://127.0.0.1:4000'],
};

export const sessionStorage = new Map<string, { codeVerifier: string; accessToken?: string }>();

export const createLogtoClient = () => new LogtoClient(logtoConfig, {
    navigate: (url: string) => {
        console.log('Navigation requested to:', url);
    },
    storage: {
        getItem: async (key: string) => sessionStorage.get(key)?.codeVerifier || null,
        setItem: async (key: string, value: string) => {
            sessionStorage.set(key, { codeVerifier: value });
        },
        removeItem: async (key: string) => {
            sessionStorage.delete(key);
        }
    }
}); 