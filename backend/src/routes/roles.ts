import express, { Response, Request } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import logger from '../utils/logger';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import {
  getRolePermissions,
  grantPermission,
  revokePermission,
  bulkUpdatePermissions,
  getAllAvailablePermissions,
  parsePermission,
} from '../services/permissions/permission-service';
import {
  logPermissionChange,
  getPermissionAuditLogs,
} from '../services/permissions/audit-logger';
import { resolveRolePermissions } from '../services/permissions/compatibility-resolver';
import { determineRoleCategory } from '../services/permissions/role-category';

const router = (express as any).Router();

// Validation schemas
const createRoleSchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()),
});

const generateInviteLinkSchema = z.object({
  roleId: z.string().uuid(),
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  message: z.string().optional(),
  expiresInDays: z.number().optional().default(7),
});

/** Shape of a role returned by GET / with select (id, name, status, permissions, _count, etc.) */
type RoleListRow = {
  id: string;
  name: string;
  status: string;
  permissions: unknown;
  defaultPassword: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { users: number; inviteLinks: number; rolePermissions: number };
};

// Get all roles
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
      const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true, // PART 1: Role lifecycle state
        permissions: true, // Legacy permissions
        defaultPassword: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            inviteLinks: true,
            rolePermissions: true, // Count explicit permissions
          },
        },
      } as any,
    }) as unknown as RoleListRow[];

    // Resolve permissions for each role (with backward compatibility)
    const rolesWithPermissions = await Promise.all(
      roles.map(async (role) => {
        try {
          // Safely extract legacy permissions from JSON
          let legacyPermissions: string[] = [];
          const permissionsValue = role.permissions;
          if (permissionsValue) {
            if (Array.isArray(permissionsValue)) {
              // Type guard: ensure all elements are strings
              const perms = permissionsValue as unknown[];
              const filtered: string[] = perms.filter((p): p is string => typeof p === 'string');
              legacyPermissions = filtered;
            } else if (typeof permissionsValue === 'string') {
              legacyPermissions = [permissionsValue];
            }
          }
          
          // Extract roleId and ensure types are explicit
          // Type assertion needed because of 'as any' in select clause
          // Convert to unknown first, then to string (as TypeScript suggests)
          const roleId = role.id as unknown as string;
          const permissionsArray: string[] = legacyPermissions;
          
          // Resolve explicit permissions (with error handling)
          let explicitPermissions: string[] = [];
          try {
            explicitPermissions = await resolveRolePermissions(roleId, permissionsArray);
          } catch (permError: any) {
            // Log but don't fail the entire request - use empty array as fallback
            console.error(`Failed to resolve permissions for role ${role.name}:`, permError.message);
            explicitPermissions = [];
          }
          
          return {
            ...role,
            explicitPermissions, // Include resolved explicit permissions
            hasExplicitPermissions: (role._count as any).rolePermissions > 0,
          };
        } catch (roleError: any) {
          // If individual role processing fails, return role without explicit permissions
          console.error(`Error processing role ${role.name}:`, roleError.message);
          return {
            ...role,
            explicitPermissions: [],
            hasExplicitPermissions: false,
          };
        }
      })
    );

    res.json(rolesWithPermissions);
  } catch (error: any) {
    console.error('Get roles error:', error);
    console.error('Error stack:', error?.stack);
    res.status(500).json({ 
      error: 'Failed to fetch roles',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// Get role by ID with explicit permissions
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        status: true,
        permissions: true,
        defaultPassword: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        // Don't select category if column doesn't exist yet - will be determined dynamically
        // category: true,
        rolePermissions: {
          orderBy: [
            { module: 'asc' },
            { submodule: 'asc' },
            { action: 'asc' },
          ],
        },
        _count: {
          select: {
            users: true,
            inviteLinks: true,
          },
        },
      },
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Resolve permissions (with backward compatibility)
    let legacyPermissions: string[] = [];
    const permissionsValue = role.permissions;
    if (permissionsValue) {
      if (Array.isArray(permissionsValue)) {
        // Type guard: ensure all elements are strings
        const perms = permissionsValue as unknown[];
        legacyPermissions = perms.filter((p): p is string => typeof p === 'string');
      } else if (typeof permissionsValue === 'string') {
        legacyPermissions = [permissionsValue];
      }
    }
    
    // Extract roleId and ensure types are explicit
    // Type assertion needed because of 'as any' in select clause
    // Convert to unknown first, then to string (as TypeScript suggests)
    const roleId = role.id as unknown as string;
    const permissionsArray: string[] = legacyPermissions;
    
    // Resolve explicit permissions (with error handling)
    let explicitPermissions: string[] = [];
    try {
      explicitPermissions = await resolveRolePermissions(roleId, permissionsArray);
    } catch (permError: any) {
      // Log but don't fail the entire request - use empty array as fallback
      console.error(`Failed to resolve permissions for role ${role.name}:`, permError.message);
      explicitPermissions = [];
    }

    res.json({
      ...role,
      explicitPermissions,
      availablePermissions: getAllAvailablePermissions(),
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// Get explicit permissions for a role
router.get('/:id/permissions', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const permissions = await getRolePermissions(req.params.id);
    res.json(permissions);
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Update role permissions (Admin only)
router.put('/:id/permissions', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { permissions } = z.object({
      permissions: z.array(z.object({
        module: z.string().min(1).max(50),
        submodule: z.string().max(50).optional(),
        action: z.string().min(1).max(50),
        granted: z.boolean(),
      })),
    }).parse(req.body);

    // Validate permission paths against available permissions
    const availablePermissions = getAllAvailablePermissions();
    const validModules = Object.keys(availablePermissions);
    
    for (const perm of permissions) {
      // Validate module exists
      if (!validModules.includes(perm.module)) {
        return res.status(400).json({ 
          error: 'Invalid module', 
          module: perm.module,
          validModules 
        });
      }
      
      // Validate action is standard or restricted
      const standardActions = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
      const restrictedActions = ['override'];
      const validActions = [...standardActions, ...restrictedActions];
      
      if (!validActions.includes(perm.action)) {
        return res.status(400).json({ 
          error: 'Invalid action', 
          action: perm.action,
          validActions 
        });
      }
      
      // Validate permission path format
      const permissionPath = perm.submodule 
        ? `${perm.module}.${perm.submodule}.${perm.action}`
        : `${perm.module}.${perm.action}`;
      
      if (permissionPath.length > 255) {
        return res.status(400).json({ 
          error: 'Permission path too long', 
          maxLength: 255 
        });
      }
      
      // Validate against alphanumeric + dots only
      if (!/^[a-z0-9.]+$/.test(permissionPath)) {
        return res.status(400).json({ 
          error: 'Invalid permission path format', 
          path: permissionPath,
          message: 'Only lowercase letters, numbers, and dots allowed'
        });
      }
    }

    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // PART 2: Admin Role Governance - Prevent permission modification
    const roleStatus = (role as any).status || 'ACTIVE';
    if (roleStatus === 'SYSTEM_LOCKED' || role.name.toLowerCase() === 'admin') {
      logger.warn(`Security event: Attempt to modify permissions for system-locked role ${role.name} by user ${req.user.id}`);
      return res.status(403).json({ 
        error: 'Cannot modify system role permissions',
        message: `The role "${role.name}" is system-locked and its permissions cannot be modified`,
        isSystemRole: true,
      });
    }

    const actorId = req.user.id;
    const actorUsername = req.user.username || req.user.email || 'unknown';

    // Get old permissions for audit
    let oldPermissions: any[] = [];
    try {
      oldPermissions = await getRolePermissions(req.params.id);
    } catch (oldPermError: any) {
      console.warn(`Failed to fetch old permissions for role ${req.params.id}: ${oldPermError?.message}`);
      // Continue without old permissions for audit - not critical
    }

    // Bulk update permissions
    try {
      await bulkUpdatePermissions(
        req.params.id,
        permissions,
        actorId
      );
    } catch (bulkError: any) {
      const errorDetails = {
        message: bulkError?.message,
        stack: bulkError?.stack,
        code: bulkError?.code,
        meta: bulkError?.meta,
        permissions: permissions.length,
        roleId: req.params.id,
        actorId,
      };
      console.error(`Failed to bulk update permissions for role ${req.params.id}:`, errorDetails);
      
      // Preserve the original error message but add context
      const errorMessage = bulkError?.message || 'Database error';
      const errorCode = bulkError?.code || 'UNKNOWN';
      throw new Error(`Failed to update permissions: ${errorMessage} (Code: ${errorCode})`);
    }

    // Log permission changes (non-blocking)
    const logPromises = permissions.map(async (perm) => {
      try {
        const oldPerm = oldPermissions.find(
          (p) => p.module === perm.module &&
                 p.submodule === (perm.submodule || null) &&
                 p.action === perm.action
        );

        await logPermissionChange({
          actorId,
          actorUsername,
          roleId: role.id,
          roleName: role.name,
          permissionPath: perm.submodule
            ? `${perm.module}.${perm.submodule}.${perm.action}`
            : `${perm.module}.${perm.action}`,
          oldValue: oldPerm ? { granted: oldPerm.granted } : null,
          newValue: { granted: perm.granted },
          changeType: oldPerm ? 'update' : 'bulk_update',
          context: {
            requestPath: req.path,
            requestMethod: req.method,
          },
        });
      } catch (logError: any) {
        console.warn(`Failed to log permission change: ${logError?.message}`);
        // Don't throw - logging failures shouldn't break the update
      }
    });
    
    // Wait for all logs, but don't fail if logging fails
    await Promise.allSettled(logPromises);

    // Get updated permissions
    let updatedPermissions: any[] = [];
    try {
      updatedPermissions = await getRolePermissions(req.params.id);
    } catch (fetchError: any) {
      console.error(`Failed to fetch updated permissions for role ${req.params.id}: ${fetchError?.message}`);
      // Return the permissions that were sent (assuming they were updated successfully)
      // This is not ideal but better than returning an error after successful update
      updatedPermissions = permissions.map(perm => ({
        roleId: req.params.id,
        module: perm.module,
        submodule: perm.submodule || null,
        action: perm.action,
        granted: perm.granted,
      }));
    }

    res.json(updatedPermissions);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    const errorInfo = {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      meta: error?.meta,
      roleId: req.params.id,
      userId: req.user?.id,
    };
    console.error('Update role permissions error:', errorInfo);
    
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: 'Failed to update permissions',
      ...(isDev && {
        details: error?.message,
        code: error?.code,
        stack: error?.stack,
        errorType: error?.name,
      }),
    });
  }
});

// Get permission audit logs
router.get('/:id/audit-logs', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const logs = await getPermissionAuditLogs(req.params.id, 100);
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Create role with user (Admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Preprocess phoneNumber - convert empty string to undefined
    const body = { ...req.body };
    if (body.phoneNumber === '' || !body.phoneNumber) {
      delete body.phoneNumber;
    }
    
    const schema = z.object({
      name: z.string().min(1, 'Role name is required'),
      permissions: z.array(z.string()).optional(),
      username: z.string().min(1, 'Username is required'),
      email: z.string().email('Invalid email format'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      phoneNumber: z.string().optional(),
    });
    
    const parsed = schema.parse(body);
    const { name, permissions, username, email, password, phoneNumber } = parsed;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Check if role already exists
    let role = await prisma.role.findUnique({
      where: { name },
      select: {
        id: true,
        name: true,
        status: true,
        permissions: true,
        defaultPassword: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        // Don't select category - may not exist yet
      },
    });

    // Hash password
    const hashedPassword = await hashPassword(password);

    // If role doesn't exist, create it
    if (!role) {
      // Default permissions if not provided
      const defaultPermissions = permissions || [];
      
      // Try to create role with category if supported, fallback without
      try {
        // PART 1: Determine role category (immutable after creation)
        const category = determineRoleCategory(name);

        role = await prisma.role.create({
          data: {
            name,
            status: 'ACTIVE', // PART 1: New roles default to ACTIVE
            category, // PART 1: Set category on creation
            permissions: defaultPermissions,
            defaultPassword: hashedPassword, // Store the password with the role
            createdBy: req.user!.id,
          } as any, // Type assertion until Prisma client is regenerated
        });
      } catch (createError: any) {
        // If category column doesn't exist, create without it
        if (createError.code === 'P2022' && createError.meta?.column?.includes('category')) {
          logger.warn('Category column not found, creating role without category');
          role = await prisma.role.create({
            data: {
              name,
              status: 'ACTIVE',
              permissions: defaultPermissions,
              defaultPassword: hashedPassword,
              createdBy: req.user!.id,
            } as any,
          });
        } else {
          throw createError;
        }
      }
    } else {
      // If role exists, just update the default password
      // Skip category backfill to avoid errors if column doesn't exist
      role = await prisma.role.update({
        where: { id: role.id },
        data: {
          defaultPassword: hashedPassword, // Update the default password
        } as any, // Type assertion until Prisma client is regenerated
      });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        roleId: role.id,
      },
      include: {
        role: true,
      },
    });

    res.status(201).json({
      role,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      console.error('Request body:', req.body);
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors,
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    }
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { permissions } = createRoleSchema.partial().extend({
      permissions: z.array(z.string()).optional(),
    }).parse(req.body);

    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        status: true,
        permissions: true,
        // Don't select category - may not exist yet
      },
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // PART 2: Admin Role Governance - System Lock
    const roleStatus = (role as any).status || 'ACTIVE';
    if (roleStatus === 'SYSTEM_LOCKED' || role.name.toLowerCase() === 'admin') {
      logger.warn(`Security event: Attempt to update system-locked role ${role.name} by user ${req.user?.id}`);
      return res.status(403).json({ 
        error: 'Cannot update system role',
        message: `The role "${role.name}" is system-locked and cannot be modified`,
        isSystemRole: true,
      });
    }

    const updatedRole = await prisma.role.update({
      where: { id: req.params.id },
      data: {
        ...(permissions && { permissions }),
      },
    });

    res.json(updatedRole);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Generate invite link (Admin only)
router.post('/generate-invite', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Preprocess and validate
    const body = { ...req.body };
    
    // Preprocess body - remove empty strings for optional fields
    const processedBody = {
      ...body,
      password: body.password && body.password.trim() ? body.password.trim() : undefined,
      message: body.message && body.message.trim() ? body.message.trim() : undefined,
    };
    
    const schema = z.object({
      roleId: z.string().uuid('Invalid role ID'),
      username: z.string().min(3, 'Username must be at least 3 characters'),
      email: z.string().email('Invalid email format'),
      password: z.string().min(6, 'Password must be at least 6 characters').optional(),
      message: z.string().optional(),
      expiresInDays: z.number().optional().default(7),
    });
    
    const { roleId, username, email, password: providedPassword, message, expiresInDays } = schema.parse(processedBody);

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        status: true,
        defaultPassword: true,
        // Don't select category - may not exist yet
      },
    }) as any; // Type assertion until Prisma client is regenerated

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check if there's a pending invite for this email
    // If exists, update it instead of creating a new one
    const existingInvite = await prisma.roleInviteLink.findFirst({
      where: {
        email,
        status: 'pending',
      },
    });

    // Note: We allow generating invite links for existing users
    // The invite link can be used to update the user's role or reset their password
    
    // Use provided password or role's default password
    let hashedPassword: string;
    let plainPasswordForAutoFill: string | null = null; // Store plain password temporarily for auto-fill
    
    if (providedPassword) {
      // Hash the provided password
      hashedPassword = await hashPassword(providedPassword);
      plainPasswordForAutoFill = providedPassword; // Store for auto-fill
    } else if (role.defaultPassword) {
      // Use the role's default password (already hashed)
      hashedPassword = role.defaultPassword;
      // Can't retrieve plain password from hash, so we'll indicate to use role default
      plainPasswordForAutoFill = null; // Will be handled on frontend
    } else {
      // Fallback: If role doesn't have defaultPassword, use the first user's password from that role
      const firstUser = await prisma.user.findFirst({
        where: { roleId: role.id },
        select: { password: true },
      });
      
      if (firstUser) {
        // Use the first user's password (already hashed)
        hashedPassword = firstUser.password;
        
        // Also update the role to set this as the default password for future use
        await prisma.role.update({
          where: { id: role.id },
          data: {
            defaultPassword: hashedPassword,
          } as any,
        });
      } else {
        return res.status(400).json({ 
          error: 'Password is required', 
          message: `The role "${role.name}" does not have a default password set and has no users. Please create a user for this role first, or provide a password when generating the invite link.`,
          requiresPassword: true 
        });
      }
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

    let inviteLink;
    
    if (existingInvite) {
      // Update existing pending invite
      inviteLink = await prisma.roleInviteLink.update({
        where: { id: existingInvite.id },
        data: {
          roleId,
          username,
          email,
          password: hashedPassword,
          message: message || `Welcome! Your role is ${role.name}`,
          token,
          expiresAt,
        },
        include: {
          role: true,
        },
      });
    } else {
      // Create new invite link
      inviteLink = await prisma.roleInviteLink.create({
        data: {
          roleId,
          username,
          email,
          password: hashedPassword,
          message: message || `Welcome! Your role is ${role.name}`,
          token,
          expiresAt,
        },
        include: {
          role: true,
        },
      });
    }

    // Generate full invite URL - redirect to /roles/login instead of /invite-login
    // Dynamically determine frontend URL from request origin
    let frontendUrl = process.env.FRONTEND_URL;
    
    if (!frontendUrl) {
      // Try to get from Referer header (the page that made the request)
      const referer = (req.headers.referer as string) || (req.headers.origin as string);
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          frontendUrl = `${refererUrl.protocol}//${refererUrl.host}`;
        } catch (e) {
          // If URL parsing fails, try to extract from referer string
          const match = referer.match(/^(https?:\/\/[^\/]+)/);
          if (match) {
            frontendUrl = match[1];
          }
        }
      }
      
      // If still not found, try to construct from request
      // Handle reverse proxy scenarios (X-Forwarded-Proto, X-Forwarded-Host)
      if (!frontendUrl) {
        // Check for forwarded protocol (for reverse proxies)
        const forwardedProto = req.headers['x-forwarded-proto'] as string;
        const forwardedHost = req.headers['x-forwarded-host'] as string;
        
        if (forwardedProto && forwardedHost) {
          frontendUrl = `${forwardedProto}://${forwardedHost}`;
        } else {
          // Use standard request protocol and host
          // Access protocol and secure through headers or connection
          const protocol = forwardedProto || ((req as any).protocol || ((req as any).secure ? 'https' : 'http'));
          const host = forwardedHost || (req.headers.host as string);
          if (host) {
            frontendUrl = `${protocol}://${host}`;
          }
        }
      }
      
      // Final fallback to localhost (for development)
      if (!frontendUrl) {
        frontendUrl = 'http://localhost:3000';
      }
    }
    
    const inviteUrl = `${frontendUrl}/role-login?token=${token}`;
    
    res.status(201).json({
      ...inviteLink,
      inviteUrl,
      // Include plain password for auto-fill (only if provided, not if using role default)
      // This will be used to auto-fill password on the login page for first time use
      // Note: This is only sent when link is generated, frontend should store it temporarily
      tempPassword: plainPasswordForAutoFill || undefined, // Only include if password was provided
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      console.error('Request body:', req.body);
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors,
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    }
    console.error('Generate invite link error:', error);
    console.error('Error details:', error);
    res.status(500).json({ error: 'Failed to generate invite link' });
  }
});

// Get invite link details by token (for auto-fill on login page)
router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const inviteLink = await prisma.roleInviteLink.findUnique({
      where: { token },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        expiresAt: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!inviteLink) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    if (inviteLink.status !== 'pending') {
      return res.status(400).json({ error: 'Invite link already used or expired' });
    }

    // Check expiration
    if (inviteLink.expiresAt) {
      const expiresAt = new Date(inviteLink.expiresAt);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invite link expired' });
      }
    }

    // Return username and email for auto-fill (but not password for security)
    res.json({
      username: inviteLink.username,
      email: inviteLink.email,
      roleName: inviteLink.role.name,
    });
  } catch (error) {
    console.error('Get invite link error:', error);
    res.status(500).json({ error: 'Failed to fetch invite link' });
  }
});

// Get invite links for a role (Admin only)
router.get('/:id/invites', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const inviteLinks = await prisma.roleInviteLink.findMany({
      where: { roleId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json(inviteLinks);
  } catch (error) {
    console.error('Get invite links error:', error);
    res.status(500).json({ error: 'Failed to fetch invite links' });
  }
});

// Get users by role (Admin only)
router.get('/:id/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { roleId: req.params.id },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PART 1: Hard Block Role Deactivation - No reassignment in same request
router.post('/:id/deactivate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = z.object({
      reason: z.string().optional(),
    }).parse(req.body);

    const roleId = req.params.id;
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        status: true,
        // Don't select category - may not exist yet
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    }) as any;

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const roleStatus = role.status || 'ACTIVE';

    // PART 2: Admin Role Governance - System Lock
    if (roleStatus === 'SYSTEM_LOCKED' || role.name.toLowerCase() === 'admin') {
      // Log security event
      logger.warn(`Security event: Attempt to deactivate system-locked role ${role.name} by user ${req.user?.id}`);
      return res.status(403).json({ 
        error: 'Cannot deactivate system role',
        message: `The role "${role.name}" is system-locked and cannot be deactivated`,
        isSystemRole: true,
      });
    }

    // PART 1: Deactivation Rules - Check if already deactivated
    if (roleStatus === 'DEACTIVATED') {
      return res.status(400).json({ 
        error: 'Role already deactivated',
        message: `The role "${role.name}" is already deactivated`,
      });
    }

    // PART 1: Hard Block - Refuse deactivation if users are assigned
    const affectedUsers = role.users || [];
    const activeUsersCount = affectedUsers.length;
    
    if (activeUsersCount > 0) {
      // Log the blocked attempt
      logger.warn(`ROLE_DEACTIVATION_BLOCKED: Attempt to deactivate role ${role.name} (${roleId}) with ${activeUsersCount} active user(s) by user ${req.user?.id}`);
      
      return res.status(400).json({ 
        error: 'ROLE_DEACTIVATION_BLOCKED',
        message: `Cannot deactivate role with ${activeUsersCount} active user(s). All users must be reassigned to another role before deactivation.`,
        roleId,
        activeUsersCount,
        affectedUsers: affectedUsers.map((u: any) => ({ id: u.id, username: u.username, email: u.email })),
        requiresReassignment: true,
      });
    }

    // PART 1: Update role status to DEACTIVATED (only if no users)
    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        status: 'DEACTIVATED',
      } as any,
    });

    // PART 1: Mandatory Audit Logging
    const actorId = req.user!.id;
    const actorUsername = req.user!.username || req.user!.email || 'unknown';
    
    try {
      await prisma.roleLifecycleAuditLog.create({
        data: {
          actorId,
          actorUsername,
          roleId: role.id,
          roleName: role.name,
          previousStatus: roleStatus,
          newStatus: 'DEACTIVATED',
          affectedUsers: affectedUsers.map((u: any) => ({ id: u.id, username: u.username, email: u.email })),
          reassignmentMap: {}, // No reassignments in deactivation endpoint
          reason: reason || 'Role deactivated by administrator',
          context: {
            requestPath: req.path,
            requestMethod: req.method,
            ip: req.ip,
          },
        } as any,
      });
    } catch (auditError: any) {
      // Audit logging failure should rollback the transaction
      logger.error(`Failed to create role lifecycle audit log: ${auditError.message}`);
      // Rollback role status if audit logging fails
      await prisma.role.update({ 
        where: { id: roleId }, 
        data: { status: roleStatus } as any 
      });
      return res.status(500).json({ 
        error: 'Audit logging failed',
        message: 'Role deactivation was rolled back due to audit logging failure',
      });
    }

    logger.info(`Role ${role.name} (${roleId}) deactivated by ${actorUsername}. Affected users: ${affectedUsers.length}`);

    res.json({
      success: true,
      role: {
        id: updatedRole.id,
        name: updatedRole.name,
        status: 'DEACTIVATED',
      },
      affectedUsers: affectedUsers.length,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Deactivate role error:', error);
    res.status(500).json({ 
      error: 'Failed to deactivate role',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

// PART 1: No Orphan Users Rule - Helper function to validate user has ≥1 ACTIVE role
// This should be called before any role removal operation
async function validateUserHasActiveRole(userId: string): Promise<{ valid: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        select: {
          id: true,
          name: true,
          status: true,
          // Don't select category - may not exist yet
        },
      },
    },
  });

  if (!user) {
    return { valid: false, error: 'User not found' };
  }

  const roleStatus = (user.role as any).status || 'ACTIVE';
  if (roleStatus !== 'ACTIVE') {
    return { valid: false, error: `User's current role is ${roleStatus}, not ACTIVE` };
  }

  return { valid: true };
}

// PART 2: System Lock Admin Role on Startup/Migration
// This ensures Admin role is always SYSTEM_LOCKED and has all permissions
async function ensureAdminRoleLocked() {
  try {
    // Use explicit select to avoid querying category column if it doesn't exist
    const adminRole = await prisma.role.findUnique({
      where: { name: 'Admin' },
      select: {
        id: true,
        name: true,
        status: true,
        // Don't select category - it may not exist yet
        // category: true,
      },
    }) as any;

    if (!adminRole) {
      logger.warn('Admin role not found');
      return;
    }

    // Ensure Admin is SYSTEM_LOCKED
    if (adminRole.status !== 'SYSTEM_LOCKED') {
      await prisma.role.update({
        where: { id: adminRole.id },
        data: { status: 'SYSTEM_LOCKED' } as any,
      });
      logger.info('Admin role locked as SYSTEM_LOCKED');
    }

    // Ensure Admin has all permissions explicitly granted
    const { ensureAdminHasAllPermissions } = await import('../services/permissions/initialize-admin-permissions');
    await ensureAdminHasAllPermissions();
  } catch (error: any) {
    // Check if error is due to missing category column
    if (error.message?.includes('category') && error.message?.includes('does not exist')) {
      logger.warn('Category column does not exist - migration may be pending. Admin role lock skipped category-related operations.');
      // Try to continue without category
      try {
        const adminRole = await prisma.role.findUnique({
          where: { name: 'Admin' },
          select: {
            id: true,
            name: true,
            status: true,
          },
        }) as any;
        
        if (adminRole && adminRole.status !== 'SYSTEM_LOCKED') {
          await prisma.role.update({
            where: { id: adminRole.id },
            data: { status: 'SYSTEM_LOCKED' } as any,
          });
          logger.info('Admin role locked as SYSTEM_LOCKED (category migration pending)');
        }
      } catch (retryError: any) {
        logger.warn(`Failed to lock Admin role after retry: ${retryError.message}`);
      }
    } else {
      logger.warn(`Failed to lock Admin role: ${error.message}`);
    }
  }
}

// Call on module load
ensureAdminRoleLocked().catch(() => {});

export default router;

