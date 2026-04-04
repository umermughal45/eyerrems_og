import express, { Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/audit-log';
import { errorResponse, successResponse } from '../utils/error-handler';
import { getLocationTree } from '../services/location';
import { LocationTreeNode } from '../services/location';
import { saveFileSecurely, validateFileUpload, scanFileForViruses } from '../utils/file-security';
// logger import removed (unused)

const router = (express as any).Router();

// Configure multer for logo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Helper function to build full path for a location
const buildLocationPath = (nodes: LocationTreeNode[], targetId: string): string[] => {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [node.name];
    }
    const childPath = buildLocationPath(node.children, targetId);
    if (childPath.length > 0) {
      return [node.name, ...childPath];
    }
  }
  return [];
};

// IMPORTANT: Route order matters! Specific routes must come before parameterized routes.

// GET all leaf locations with full paths for dropdown (specific route - must come first)
router.get('/locations/with-paths', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const { getLeafLocationsWithPaths } = await import('../services/location');
    const leaves = await getLeafLocationsWithPaths();
    return successResponse(res, leaves || []);
  } catch (error: any) {
    console.error('Error fetching leaf locations with paths:', error);
    // Return empty array on error, don't crash the page
    return successResponse(res, []);
  }
});

// GET subsidiary options for a location (parameterized - comes after specific routes)
router.get('/location/:locationId/options', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { locationId } = req.params;
    const subsidiary = await prisma.propertySubsidiary.findFirst({
      where: { 
        locationId,
        isActive: true,
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!subsidiary) {
      return successResponse(res, []);
    }

    // Fetch location separately
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        isLeaf: true,
        isActive: true,
      },
    });

    // Only return options if location is active and leaf (if columns exist)
    if (location && location.isActive !== undefined && location.isLeaf !== undefined) {
      if (!location.isActive || !location.isLeaf) {
        return successResponse(res, []);
      }
    }

    return successResponse(res, subsidiary.options);
  } catch (error: any) {
    // If columns don't exist, try without isActive filter
    if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
      try {
        const { locationId } = req.params;
        const subsidiary = await prisma.propertySubsidiary.findFirst({
          where: { 
            locationId,
          },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        });
        return successResponse(res, subsidiary?.options || []);
      } catch (fallbackError) {
        return successResponse(res, []);
      }
    }
    return errorResponse(res, error);
  }
});

// GET subsidiaries by location ID (parameterized route)
router.get('/location/:locationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { locationId } = req.params;
    const subsidiaries = await prisma.propertySubsidiary.findMany({
      where: { 
        locationId,
        isActive: true,
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch location separately and filter to only return subsidiaries for active leaf locations (if columns exist)
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        isLeaf: true,
        isActive: true,
      },
    });

    // Filter to only return subsidiaries for active leaf locations (if columns exist)
    const validSubsidiaries = location && location.isActive !== undefined && location.isLeaf !== undefined
      ? (location.isActive && location.isLeaf ? subsidiaries : [])
      : subsidiaries;

    return successResponse(res, validSubsidiaries);
  } catch (error: any) {
    // If columns don't exist, try without isActive filter
    if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
      try {
        const { locationId } = req.params;
          const subsidiaries = await prisma.propertySubsidiary.findMany({
          where: { 
            locationId,
          },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        return successResponse(res, subsidiaries);
      } catch (fallbackError) {
        return successResponse(res, []);
      }
    }
    return errorResponse(res, error);
  }
});

// GET all subsidiaries with their locations
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  // Log route resolution for debugging
  console.log('[Subsidiaries Route] GET / - Resolved path:', _req.path, 'Original URL:', _req.originalUrl, 'Base URL:', _req.baseUrl);
  try {
    // Get only active subsidiaries, then filter by location status
    const allSubsidiaries = await prisma.propertySubsidiary.findMany({
      where: {
        isActive: true,
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all locations for filtering
    const locationIds = [...new Set(allSubsidiaries.map(s => s.locationId))];
    const locations = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        isLeaf: true,
        isActive: true,
      },
    });
    const locationMap = new Map(locations.map(l => [l.id, l]));

    // Filter to only active leaf locations
    const subsidiaries = allSubsidiaries.filter((sub) => {
      const location = locationMap.get(sub.locationId);
      if (location && location.isActive !== undefined && location.isLeaf !== undefined) {
        return location.isActive && location.isLeaf;
      }
      return true; // If columns don't exist, include all
    });

    // If no subsidiaries, return empty array immediately
    if (!subsidiaries || subsidiaries.length === 0) {
      return successResponse(res, []);
    }

    // Try to get location tree for path building, but don't fail if it errors
    let tree: LocationTreeNode[] = [];
    try {
      tree = await getLocationTree();
    } catch (treeError) {
      console.warn('Could not fetch location tree for path building:', treeError);
      // Continue without tree - we'll use location name as fallback
    }

    // Add full path to each subsidiary
    const subsidiariesWithPaths = subsidiaries
      .map((sub) => {
        try {
          const location = locationMap.get(sub.locationId);
          if (tree.length > 0) {
            const path = buildLocationPath(tree, sub.locationId);
            // Only return if path was successfully built (all parents are active)
            if (path.length > 0) {
              return {
                ...sub,
                locationPath: path.join(' > '),
              };
            }
          }
          // Fallback: use location name if path building fails
          return {
            ...sub,
            locationPath: location?.name || 'Unknown Location',
          };
        } catch (err) {
          // If path building fails, skip this subsidiary
          return null;
        }
      })
      .filter((sub): sub is NonNullable<typeof sub> => sub !== null); // Remove null entries

    return successResponse(res, subsidiariesWithPaths);
  } catch (error: any) {
    console.error('Error fetching subsidiaries:', error);
    // If columns don't exist, try without isActive/isLeaf filters
    if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
      try {
        const subsidiaries = await prisma.propertySubsidiary.findMany({
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Fetch all locations
        const locationIds = [...new Set(subsidiaries.map(s => s.locationId))];
        const locations = await prisma.location.findMany({
          where: { id: { in: locationIds } },
          select: {
            id: true,
            name: true,
            type: true,
            parentId: true,
          },
        });
        const locationMap = new Map(locations.map(l => [l.id, l]));

        // Try to get location tree for path building, but don't fail if it errors
        let tree: LocationTreeNode[] = [];
        try {
          tree = await getLocationTree();
        } catch (treeError) {
          console.warn('Could not fetch location tree for path building:', treeError);
        }

        const subsidiariesWithPaths = subsidiaries.map((sub) => {
          try {
            const location = locationMap.get(sub.locationId);
            if (tree.length > 0) {
              const path = buildLocationPath(tree, sub.locationId);
              if (path.length > 0) {
                return {
                  ...sub,
                  locationPath: path.join(' > '),
                };
              }
            }
            return {
              ...sub,
              locationPath: location?.name || 'Unknown Location',
            };
          } catch (err) {
            const location = locationMap.get(sub.locationId);
            return {
              ...sub,
              locationPath: location?.name || 'Unknown Location',
            };
          }
        });

        return successResponse(res, subsidiariesWithPaths);
      } catch (fallbackError) {
        // GET requests should NEVER return 400/500 - return empty array instead
        return successResponse(res, []);
      }
    }
    // GET requests should NEVER return 400/500 - return empty array instead
    return successResponse(res, []);
  }
});

// GET single subsidiary by ID (generic route - comes last)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  // Log route resolution for debugging
  console.log('[Subsidiaries Route] GET /:id - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl, 'ID:', req.params.id);
  try {
    const { id } = req.params;
    const subsidiary = await prisma.propertySubsidiary.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!subsidiary) {
      return errorResponse(res, 'Subsidiary not found', 404);
    }

    return successResponse(res, subsidiary);
  } catch (error) {
    return errorResponse(res, error);
  }
});

const createSubsidiarySchema = z.object({
  locationId: z.string().uuid('Location ID must be a valid UUID'),
  options: z.array(z.string().min(1, 'Option name cannot be empty')).min(1, 'At least one option is required'),
  logoPath: z.string().optional(), // Optional logo path if uploaded via base64
});

// POST create subsidiary with logo upload support
router.post('/', authenticate, requireAdmin, upload.single('logo'), async (req: AuthRequest, res: Response) => {
  // Log route resolution for debugging
  console.log('[Subsidiaries Route] POST / - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl);
  console.log('[Subsidiaries Route] POST / - Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Parse JSON body if sent as form-data
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // If parsing fails, use as is
      }
    }

    // Normalize options field to array if it's a string (common with FormData)
    if (body.options) {
      if (typeof body.options === 'string') {
        try {
          // Try parsing as JSON first (e.g. "[\"A\",\"B\"]")
          const parsed = JSON.parse(body.options);
          if (Array.isArray(parsed)) {
            body.options = parsed;
          } else {
            // If valid JSON but not array (e.g. "some string"), wrap it
            body.options = [body.options];
          }
        } catch {
          // Not valid JSON, treat as single string value -> wrap in array
          body.options = [body.options];
        }
      } else if (!Array.isArray(body.options)) {
        // If it exists but is not an array (and not a string), wrap it
        body.options = [body.options];
      }
    }
    
    const payload = createSubsidiarySchema.parse(body);
    let logoPath: string | null = null;

    // Check if location exists and is a leaf
    const location = await prisma.location.findUnique({
      where: { id: payload.locationId },
    });

    if (!location) {
      return errorResponse(res, 'Location not found', 404);
    }

    const locationData = location as any;
    if (locationData.isActive !== undefined && locationData.isActive === false) {
      return errorResponse(res, 'Cannot create subsidiary for inactive location', 400);
    }

    if (locationData.isLeaf !== undefined && locationData.isLeaf === false) {
      return errorResponse(res, 'Subsidiaries can only be created for leaf locations (locations without children)', 400);
    }

    // Check if subsidiary already exists for this location
    const existing = await prisma.propertySubsidiary.findFirst({
      where: { locationId: payload.locationId },
    });

    if (existing) {
      return errorResponse(res, 'Subsidiary already exists for this location. Please update the existing one instead.', 400);
    }

    // Handle logo upload (from multer file or base64)
    if (req.file) {
      // Logo uploaded via multer (form-data)
      const validation = await validateFileUpload(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      if (!validation.valid) {
        return errorResponse(res, validation.error || 'Invalid logo file', 400);
      }

      // Scan for viruses
      const tempPath = path.join(process.cwd(), 'public', 'uploads', `temp-${Date.now()}-${req.file.originalname}`);
      fs.writeFileSync(tempPath, req.file.buffer);
      const scanResult = await scanFileForViruses(tempPath);
      
      if (!scanResult.clean) {
        fs.unlinkSync(tempPath);
        return errorResponse(res, 'Logo file failed virus scan', 400);
      }

      // Save file securely
      const { relativePath } = await saveFileSecurely(
        req.file.buffer,
        req.file.originalname,
        'logos',
        req.user!.id
      );
      
      logoPath = relativePath;
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    } else if (payload.logoPath) {
      // Logo path provided directly (from base64 upload via /api/upload endpoint)
      logoPath = payload.logoPath;
    }

    // Create subsidiary with options in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const subsidiary = await tx.propertySubsidiary.create({
        data: {
          locationId: payload.locationId,
          name: location.name, // Store location name for quick reference
          logoPath: logoPath,
          isActive: true,
        },
      });

      // Create all options
      const options = await Promise.all(
        payload.options.map((optionName, index) =>
          tx.subsidiaryOption.create({
            data: {
              propertySubsidiaryId: subsidiary.id,
              name: optionName.trim(),
              sortOrder: index,
            },
          })
        )
      );

      return { subsidiary, options };
    });

    await createAuditLog({
      entityType: 'property_subsidiary',
      entityId: result.subsidiary.id,
      action: 'create',
      description: `Subsidiary created for location ${location.name} with ${payload.options.length} options`,
      newValues: result,
      userId: req.user?.id,
      userName: req.user?.username,
      req,
    });

    return successResponse(res, result, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, error.errors[0].message, 400);
    }
    return errorResponse(res, error);
  }
});

const updateSubsidiarySchema = z.object({
  options: z.array(z.string().min(1, 'Option name cannot be empty')).min(1, 'At least one option is required').optional(),
  logoPath: z.string().optional(), // Optional logo path update
});

// PUT update subsidiary (options and logo can be updated)
router.put('/:id', authenticate, requireAdmin, upload.single('logo'), async (req: AuthRequest, res: Response) => {
  // Log route resolution for debugging
  console.log('[Subsidiaries Route] PUT /:id - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl, 'ID:', req.params.id);
  console.log('[Subsidiaries Route] PUT /:id - Request Body:', JSON.stringify(req.body, null, 2));

  try {
    const { id } = req.params;
    
    // Parse JSON body if sent as form-data
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // If parsing fails, use as is
      }
    }

    // Normalize options field to array if it's a string (common with FormData)
    if (body.options) {
      if (typeof body.options === 'string') {
        try {
          // Try parsing as JSON first (e.g. "[\"A\",\"B\"]")
          const parsed = JSON.parse(body.options);
          if (Array.isArray(parsed)) {
            body.options = parsed;
          } else {
            // If valid JSON but not array (e.g. "some string"), wrap it
            body.options = [body.options];
          }
        } catch {
          // Not valid JSON, treat as single string value -> wrap in array
          body.options = [body.options];
        }
      } else if (!Array.isArray(body.options)) {
        // If it exists but is not an array (and not a string), wrap it
        body.options = [body.options];
      }
    }
    
    const payload = updateSubsidiarySchema.parse(body);
    let logoPath: string | null | undefined = undefined;

    const existing = await prisma.propertySubsidiary.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!existing) {
      return errorResponse(res, 'Subsidiary not found', 404);
    }

    // Handle logo upload if provided
    if (req.file) {
      // Logo uploaded via multer (form-data)
      const validation = await validateFileUpload(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      if (!validation.valid) {
        return errorResponse(res, validation.error || 'Invalid logo file', 400);
      }

      // Scan for viruses
      const tempPath = path.join(process.cwd(), 'public', 'uploads', `temp-${Date.now()}-${req.file.originalname}`);
      fs.writeFileSync(tempPath, req.file.buffer);
      const scanResult = await scanFileForViruses(tempPath);
      
      if (!scanResult.clean) {
        fs.unlinkSync(tempPath);
        return errorResponse(res, 'Logo file failed virus scan', 400);
      }

      // Save file securely
      const { relativePath } = await saveFileSecurely(
        req.file.buffer,
        req.file.originalname,
        'logos',
        req.user!.id
      );
      
      logoPath = relativePath;
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    } else if (payload.logoPath !== undefined) {
      // Logo path provided directly (from base64 upload via /api/upload endpoint)
      logoPath = payload.logoPath || null;
    }

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update logo if provided
      const updateData: any = {};
      if (logoPath !== undefined) {
        updateData.logoPath = logoPath;
      }

      // Update options if provided
      if (payload.options && payload.options.length > 0) {
        // Delete existing options
        await tx.subsidiaryOption.deleteMany({
          where: { propertySubsidiaryId: id },
        });

        // Create new options
        const options = await Promise.all(
          payload.options.map((optionName, index) =>
            tx.subsidiaryOption.create({
              data: {
                propertySubsidiaryId: id,
                name: optionName.trim(),
                sortOrder: index,
              },
            })
          )
        );
        updateData.options = options;
      }

      // Update subsidiary
      const updated = await tx.propertySubsidiary.update({
        where: { id },
        data: updateData,
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });

      return { subsidiary: updated, options: updated.options };
    });

    await createAuditLog({
      entityType: 'property_subsidiary',
      entityId: id,
      action: 'update',
      description: payload.options && payload.options.length > 0
        ? `Subsidiary updated with ${payload.options.length} options`
        : 'Subsidiary updated',
      oldValues: existing,
      newValues: result,
      userId: req.user?.id,
      userName: req.user?.username,
      req,
    });

    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, error.errors[0].message, 400);
    }
    return errorResponse(res, error);
  }
});

// DELETE subsidiary (soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  // Log route resolution for debugging
  console.log('[Subsidiaries Route] DELETE /:id - Resolved path:', req.path, 'Original URL:', req.originalUrl, 'Base URL:', req.baseUrl, 'ID:', req.params.id);
  try {
    const { id } = req.params;
    const existing = await prisma.propertySubsidiary.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!existing) {
      return errorResponse(res, 'Subsidiary not found', 404);
    }

    // Fetch location separately
    const location = await prisma.location.findUnique({
      where: { id: existing.locationId },
      select: { name: true },
    });

    // Check if any properties use this subsidiary's options
    const optionIds = existing.options.map(opt => opt.id);
    const propertiesCount = optionIds.length > 0 ? await prisma.property.count({
      where: { 
        subsidiaryOptionId: { in: optionIds },
      },
    }) : 0;

    if (propertiesCount > 0) {
      return errorResponse(
        res,
        `Cannot delete subsidiary. ${propertiesCount} propert${propertiesCount === 1 ? 'y' : 'ies'} use this subsidiary.`,
        400
      );
    }

    // Soft delete: set isActive = false
    await prisma.propertySubsidiary.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      entityType: 'property_subsidiary',
      entityId: id,
      action: 'delete',
      description: `Subsidiary deactivated for location ${location?.name || existing.locationId}`,
      oldValues: existing,
      userId: req.user?.id,
      userName: req.user?.username,
      req,
    });

    return successResponse(res, { message: 'Subsidiary deactivated successfully' });
  } catch (error) {
    return errorResponse(res, error);
  }
});

export default router;

