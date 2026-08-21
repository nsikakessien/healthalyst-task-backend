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
  const cookieToken = req.cookies?.jwt_token;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : cookieToken;

  if (!token) {
    return res.status(401).json({ error: "Authentication token required." });
  }

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
  const requestedTenantId = req.headers["x-clinic-id"] as string | undefined;
  const tenantId =
    req.user?.role === "ADMIN"
      ? req.user.clinicId
      : requestedTenantId || req.user?.clinicId;
  if (!tenantId) {
    return res
      .status(400)
      .json({ error: "Missing tenant context in x-clinic-id header." });
  }
  if (
    req.user?.role === "ADMIN" &&
    requestedTenantId &&
    requestedTenantId !== tenantId
  ) {
    return res
      .status(403)
      .json({ error: "You can only access your assigned clinic." });
  }
  req.tenantId = tenantId;
  next();
};

export const requireRole =
  (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "You are not authorized for this operation." });
    }
    next();
  };
