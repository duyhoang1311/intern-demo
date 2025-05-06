import jwt, { JwtPayload } from "jsonwebtoken";
import { db } from "./db";
import { APIError } from "encore.dev/api";
import { verifyLogtoAuth } from "./user/auth";

const SECRET_KEY = process.env.SECRET_KEY || "your-secret-key";

export class JWTSimulator {
  static generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, SECRET_KEY, { expiresIn: "1h" });
  }

  static verifyToken(token: string): { userId: string; role: string } | null {
    try {
      const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload;
      return { userId: decoded.userId, role: decoded.role };
    } catch (error) {
      return null;
    }
  }

  static async getUserFromToken(token: string): Promise<{
    id: string;
    email: string;
    workspaceId: string;
    role: string;
  } | null> {
    const decoded = this.verifyToken(token);
    if (!decoded) return null;

    const user = await db.queryRow`
      SELECT id, email, workspace_id
      FROM "user"
      WHERE id = ${decoded.userId}
    `;

    return user
      ? {
          id: user.id,
          email: user.email,
          workspaceId: user.workspace_id,
          role: decoded.role,
        }
      : null;
  }

  // Hàm kiểm tra nếu người dùng có quyền admin
  static isAdmin(user: { role: string }): boolean {
    return user.role === "admin";
  }
}




