import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createActivity } from '../utils/activity';
import { validateTID } from '../services/id-generation-service';

const router = (express as any).Router();

// Validation schemas
const createUnitSchema = z.object({
  tid: z.string().min(1, 'TID is required'),
  unitName: z.string().min(1, 'Unit name is required'),
  propertyId: z.string().uuid('Invalid property ID'),
  blockId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional(),
  status: z.enum(['Occupied', 'Vacant', 'Under Maintenance']).optional(),
  monthlyRent: z.number().positive().optional(),
  description: z.string().optional(),
  unitType: z.string().optional(),
  sizeSqFt: z.number().positive().optional(),
  securityDeposit: z.number().nonnegative().optional(),
  utilitiesIncluded: z.array(z.string()).optional().default([]),
});

const updateUnitSchema = createUnitSchema.partial();

// Get all units
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, blockId, status, search } = req.query;

    const where: any = {
      isDeleted: false,
    };

    if (propertyId) {
      where.propertyId = propertyId as string;
    }

    if (blockId) {
      where.blockId = blockId as string;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { unitName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            type: true, // Include type to filter out units from houses
          },
        },
        block: {
          select: {
            id: true,
            name: true,
          },
        },
        floor: {
          select: {
            id: true,
            name: true,
            floorNumber: true,
          },
        },
        tenant: {
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map units to include tenant name
    const unitsWithTenantName = units.map((unit) => ({
      ...unit,
      tenantName: unit.tenant?.name || null,
    }));

    res.json({
      success: true,
      data: unitsWithTenantName,
    });
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch units',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get unit by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const unit = await prisma.unit.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        property: true,
        block: true,
        tenant: {
          where: { isDeleted: false },
        },
        leases: {
          where: { isDeleted: false },
          orderBy: { leaseStart: 'desc' },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found',
      });
    }

    res.json({
      success: true,
      data: unit,
    });
  } catch (error) {
    console.error('Get unit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create unit for a floor
router.post('/floors/:floorId/units', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { floorId } = req.params;
    const { tid, unitName, unitType, status, monthlyRent, description, sizeSqFt, securityDeposit, utilitiesIncluded } = req.body;

    if (!tid || typeof tid !== 'string' || tid.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'TID is required',
      });
    }

    if (!unitName || typeof unitName !== 'string' || unitName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Unit name is required',
      });
    }

    // Verify floor exists and get property ID
    const floor = await prisma.floor.findFirst({
      where: { id: floorId, isDeleted: false },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found',
      });
    }

    // Check if unit name already exists in this property
    const existingUnit = await prisma.unit.findFirst({
      where: {
        propertyId: floor.propertyId,
        unitName: unitName.trim(),
        isDeleted: false,
      },
    });

    if (existingUnit) {
      return res.status(400).json({
        success: false,
        error: 'Unit name already exists in this property',
      });
    }

    // Validate TID
    await validateTID(tid);

    const unit = await prisma.unit.create({
      data: {
        unitName: unitName.trim(),
        propertyId: floor.propertyId,
        floorId: floorId,
        tid,
        status: status || 'Vacant',
        monthlyRent: monthlyRent ? parseFloat(monthlyRent) : null,
        description: description || null,
        unitType: unitType || null,
        sizeSqFt: sizeSqFt ? parseFloat(sizeSqFt) : null,
        securityDeposit: securityDeposit ? parseFloat(securityDeposit) : null,
        utilitiesIncluded: Array.isArray(utilitiesIncluded) ? utilitiesIncluded : [],
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        floor: {
          select: {
            id: true,
            name: true,
            floorNumber: true,
          },
        },
      },
    });

    // Update property totalUnits count
    await prisma.property.update({
      where: { id: floor.propertyId },
      data: {
        totalUnits: {
          increment: 1,
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Unit added successfully',
      data: unit,
    });
  } catch (error) {
    console.error('Create unit for floor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create unit
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createUnitSchema.parse(req.body);

    // Validate TID
    await validateTID(data.tid);

    // Verify property exists
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, isDeleted: false },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
      });
    }

    // If blockId is provided, verify block exists
    if (data.blockId) {
      const block = await prisma.block.findFirst({
        where: { id: data.blockId, isDeleted: false },
      });

      if (!block) {
        return res.status(404).json({
          success: false,
          error: 'Block not found',
        });
      }
    }

    // If floorId is provided, verify floor exists and belongs to the same property
    if (data.floorId) {
      const floor = await prisma.floor.findFirst({
        where: { id: data.floorId, isDeleted: false },
      });

      if (!floor) {
        return res.status(404).json({
          success: false,
          error: 'Floor not found',
        });
      }

      if (floor.propertyId !== data.propertyId) {
        return res.status(400).json({
          success: false,
          error: 'Floor does not belong to the selected property',
        });
      }
    }

    // Validate TID
    await validateTID(data.tid);

    const unit = await prisma.unit.create({
      data: {
        ...data,
        tid: data.tid,
        unitType: data.unitType,
        sizeSqFt: data.sizeSqFt,
        securityDeposit: data.securityDeposit,
        utilitiesIncluded: data.utilitiesIncluded || [],
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            status: true,
          },
        },
        block: true,
        floor: {
          select: {
            id: true,
            name: true,
            floorNumber: true,
          },
        },
      },
    });

    // Update property totalUnits count
    await prisma.property.update({
      where: { id: data.propertyId },
      data: {
        totalUnits: {
          increment: 1,
        },
      },
    });

    // Log activity
    await createActivity({
      type: 'unit',
      action: 'created',
      entityId: unit.id,
      entityName: unit.unitName,
      message: `Unit "${unit.unitName}" was added to property "${property.name}"`,
      userId: req.user?.id,
      metadata: {
        unitId: unit.id,
        unitName: unit.unitName,
        propertyId: property.id,
        propertyName: property.name,
        status: unit.status,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Unit added successfully',
      data: unit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Create unit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update unit
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateUnitSchema.parse(req.body);

    const unit = await prisma.unit.findFirst({
      where: { id, isDeleted: false },
      include: {
        tenant: {
          where: { isDeleted: false },
          include: {
            leases: {
              where: {
                status: 'Active',
                isDeleted: false,
              },
            },
          },
        },
        leases: {
          where: {
            status: 'Active',
            isDeleted: false,
          },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found',
      });
    }

    // Check if monthlyRent is being updated and unit has active leases
    if (data.monthlyRent !== undefined && data.monthlyRent !== unit.monthlyRent) {
      const activeLeases = unit.leases || [];
      const tenantActiveLeases = unit.tenant?.leases || [];
      const allActiveLeases = [...activeLeases, ...tenantActiveLeases];

      if (allActiveLeases.length > 0) {
        // Return warning but allow update
        return res.status(200).json({
          success: true,
          message: 'Unit rent updated. Note: This change does not automatically update active leases. Please review and update leases manually if needed.',
          warning: `This unit has ${allActiveLeases.length} active lease(s). The rent change will not affect existing leases automatically.`,
          activeLeases: allActiveLeases.map(l => ({
            id: l.id,
            leaseNumber: l.leaseNumber,
            tenantId: l.tenantId,
            leaseStart: l.leaseStart,
            leaseEnd: l.leaseEnd,
            currentRent: l.rent,
          })),
          data: null,
        });
      }
    }

    const updatedUnit = await prisma.unit.update({
      where: { id },
      data: {
        ...data,
        unitType: data.unitType,
        sizeSqFt: data.sizeSqFt,
        securityDeposit: data.securityDeposit,
        utilitiesIncluded: data.utilitiesIncluded,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            status: true,
          },
        },
        block: true,
        floor: {
          select: {
            id: true,
            name: true,
            floorNumber: true,
          },
        },
        tenant: {
          where: { isDeleted: false },
        },
      },
    });

    // Update property totalUnits if status changed from/to Vacant
    if (data.status && data.status !== unit.status) {
      // Status change handled automatically by property calculations
      // But we can trigger a recalculation
      const property = await prisma.property.findUnique({
        where: { id: unit.propertyId },
        select: {
          id: true,
          units: { where: { isDeleted: false } },
        },
      });

      if (property) {
        const occupiedCount = property.units.filter(u => u.status === 'Occupied').length;
        // Property status will be updated by other workflows
      }
    }

    res.json({
      success: true,
      message: 'Unit updated successfully',
      data: updatedUnit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Update unit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete unit (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const unit = await prisma.unit.findFirst({
      where: { id, isDeleted: false },
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found',
      });
    }

    await prisma.unit.update({
      where: { id },
      data: { isDeleted: true },
    });

    // Update property totalUnits count
    await prisma.property.update({
      where: { id: unit.propertyId },
      data: {
        totalUnits: {
          decrement: 1,
        },
      },
    });

    res.json({
      success: true,
      message: 'Unit deleted successfully',
    });
  } catch (error) {
    console.error('Delete unit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get floor-based analytics for a property
router.get('/analytics/floors/:propertyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId } = req.params;

    // Get all floors for the property with their units
    const floors = await prisma.floor.findMany({
      where: {
        propertyId,
        isDeleted: false,
      },
      include: {
        units: {
          where: { isDeleted: false },
          include: {
            tenant: {
              where: { isDeleted: false },
            },
          },
        },
      },
      orderBy: {
        floorNumber: 'asc',
      },
    });

    // Calculate analytics per floor
    const floorAnalytics = floors.map((floor) => {
      const totalUnits = floor.units.length;
      const occupiedUnits = floor.units.filter((u) => u.status === 'Occupied').length;
      const vacantUnits = totalUnits - occupiedUnits;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
      
      // Calculate revenue from occupied units
      const revenue = floor.units
        .filter((u) => u.status === 'Occupied' && u.monthlyRent)
        .reduce((sum, u) => sum + (u.monthlyRent || 0), 0);

      return {
        floorId: floor.id,
        floorName: floor.name,
        floorNumber: floor.floorNumber,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        revenue,
      };
    });

    res.json({
      success: true,
      data: floorAnalytics,
    });
  } catch (error) {
    console.error('Get floor analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch floor analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

