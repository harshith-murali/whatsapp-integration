import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { createAdminSchema, updateAdminSchema, updateAdminStatusSchema } from "../validators/admin.js";
import { BadRequestError, NotFoundError, ConflictError } from "../utils/errors.js";
import { AdminRole, Prisma } from "../generated/prisma/client.js";

// Helper to check if a SUPER_ADMIN is the last active one
const isLastActiveSuperAdmin = async (adminId: number): Promise<boolean> => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== AdminRole.SUPER_ADMIN || !admin.isActive) {
    return false;
  }

  const activeSuperAdmins = await prisma.admin.count({
    where: {
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  return activeSuperAdmins <= 1;
};

export const getAdmins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid admin ID");
    }

    const admin = await prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      throw new NotFoundError("Admin not found");
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

export const createAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createAdminSchema.parse(req.body);

    const existing = await prisma.admin.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      throw new ConflictError("An admin with this email already exists");
    }

    const passwordHash = await bcrypt.hash(validated.password, 12);

    const admin = await prisma.admin.create({
      data: {
        name: validated.name,
        email: validated.email,
        passwordHash,
        role: validated.role,
        isActive: validated.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid admin ID");
    }

    const validated = updateAdminSchema.parse(req.body);
    const loggedInAdminId = req.admin?.id;

    const admin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundError("Admin not found");
    }

    // Check duplicate email
    if (validated.email && validated.email !== admin.email) {
      const existing = await prisma.admin.findUnique({
        where: { email: validated.email },
      });
      if (existing) {
        throw new ConflictError("An admin with this email already exists");
      }
    }

    // Prepare update data
    const updateData: Prisma.AdminUpdateInput = {
      name: validated.name !== undefined ? validated.name : admin.name,
      email: validated.email !== undefined ? validated.email : admin.email,
    };

    // Handle password update if explicitly provided and not empty
    if (validated.password) {
      updateData.passwordHash = await bcrypt.hash(validated.password, 12);
    }

    // Handle role update
    if (validated.role !== undefined && validated.role !== admin.role) {
      // If de-promoting a SUPER_ADMIN, check if it's the last active SUPER_ADMIN
      if (admin.role === AdminRole.SUPER_ADMIN && validated.role !== AdminRole.SUPER_ADMIN) {
        const lastActive = await isLastActiveSuperAdmin(id);
        if (lastActive) {
          throw new BadRequestError("Cannot change the role of the final active SUPER_ADMIN");
        }
      }
      updateData.role = validated.role;
    }

    // Handle active state update
    if (validated.isActive !== undefined && validated.isActive !== admin.isActive) {
      // 1. Cannot deactivate yourself
      if (id === loggedInAdminId && !validated.isActive) {
        throw new BadRequestError("You cannot deactivate your own logged-in account");
      }
      // 2. Cannot deactivate the final active SUPER_ADMIN
      if (!validated.isActive) {
        const lastActive = await isLastActiveSuperAdmin(id);
        if (lastActive) {
          throw new BadRequestError("Cannot deactivate the final active SUPER_ADMIN");
        }
      }
      updateData.isActive = validated.isActive;
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid admin ID");
    }

    const validated = updateAdminStatusSchema.parse(req.body);
    const loggedInAdminId = req.admin?.id;

    const admin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundError("Admin not found");
    }

    // 1. Cannot deactivate yourself
    if (id === loggedInAdminId && !validated.isActive) {
      throw new BadRequestError("You cannot deactivate your own logged-in account");
    }

    // 2. Cannot deactivate the final active SUPER_ADMIN
    if (!validated.isActive) {
      const lastActive = await isLastActiveSuperAdmin(id);
      if (lastActive) {
        throw new BadRequestError("Cannot deactivate the final active SUPER_ADMIN");
      }
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: { isActive: validated.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new BadRequestError("Invalid admin ID");
    }

    const loggedInAdminId = req.admin?.id;

    const admin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundError("Admin not found");
    }

    // 1. Cannot delete yourself
    if (id === loggedInAdminId) {
      throw new BadRequestError("You cannot delete your own logged-in account");
    }

    // 2. Cannot delete the final active SUPER_ADMIN
    const lastActive = await isLastActiveSuperAdmin(id);
    if (lastActive) {
      throw new BadRequestError("Cannot delete the final active SUPER_ADMIN");
    }

    await prisma.admin.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
