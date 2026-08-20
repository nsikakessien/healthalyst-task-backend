import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; clinicId?: string; email: string };
  tenantId?: string;
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication token required." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecret",
    ) as any;
    req.user = payload;
    next();
  } catch (err) {
    return res
      .status(403)
      .json({ error: "Invalid or expired authentication token." });
  }
};

export const requireTenant = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const tenantId = (req.headers["x-clinic-id"] as string) || req.user?.clinicId;
  if (!tenantId) {
    return res
      .status(400)
      .json({ error: "Missing tenant context in x-clinic-id header." });
  }
  req.tenantId = tenantId;
  next();
};
