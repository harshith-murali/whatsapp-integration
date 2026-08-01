import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";

export const getWorkerHeartbeats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const heartbeats = await prisma.workerHeartbeat.findMany({
      orderBy: { lastHeartbeatAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: heartbeats,
    });
  } catch (error) {
    next(error);
  }
};
export default getWorkerHeartbeats;
