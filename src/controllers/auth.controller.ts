import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";

export const login = async (req: Request, res: Response) => {
  const { email, password, portal } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: "Invalid credentials." });

    if (portal === "admin" && user.role !== "ADMIN") {
      return res
        .status(403)
        .json({
          error: "Only clinic administrators can use the admin portal.",
        });
    }
    if (portal === "patient" && user.role !== "PATIENT") {
      return res
        .status(403)
        .json({ error: "Only patients can use the patient portal." });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "1d" },
    );

    // Attach JWT to HTTP-Only Cookie
    res.cookie("jwt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: "/",
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie("jwt_token", { path: "/" });
  return res.status(200).json({ message: "Logged out successfully." });
};
