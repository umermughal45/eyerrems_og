import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';

export type LocationRow = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LocationTreeNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  propertyCount: number;
  children: LocationTreeNode[];
};

const normalizeName = (value: string) => value.trim();
const normalizeType = (value: string) => value.trim().toLowerCase();

const handleUniqueError = (error: unknown) => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new Error('Location with this name already exists under the parent level');
  }

  throw error;
};

const buildPropertyCountMap = (counts: { locationId: string | null; _count: number }[]) => {
  return new Map(
    counts
      .filter((row) => row.locationId !== null)
      .map((row) => [row.locationId as string, row._count]),
  );
};

export function buildLocationTree(
  rows: LocationRow[],
  propertyCountMap: Map<string, number> = new Map(),
): LocationTreeNode[] {
  const nodes = new Map<string, LocationTreeNode>();

  rows.forEach((row) => {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      type: row.type,
      parentId: row.parentId,
      propertyCount: propertyCountMap.get(row.id) ?? 0,
      children: [],
    });
  });

  const roots: LocationTreeNode[] = [];

  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (list: LocationTreeNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((child) => sortNodes(child.children));
  };

  sortNodes(roots);

  return roots;
}

const fetchSubtreeRows = async (locationId: string): Promise<LocationRow[]> => {
  const query = Prisma.sql`
    WITH RECURSIVE subtree AS (
      SELECT
        "id",
        "name",
        "type",
        "parentId",
        "createdAt",
        "updatedAt"
      FROM "Location"
      WHERE "id" = ${locationId}
      UNION ALL
      SELECT
        l."id",
        l."name",
        l."type",
        l."parentId",
        l."createdAt",
        l."updatedAt"
      FROM "Location" l
      JOIN subtree s ON l."parentId" = s."id"
    )
    SELECT * FROM subtree;
  `;
  return prisma.$queryRaw<LocationRow[]>(query);
};

export const getLocationTree = async (): Promise<LocationTreeNode[]> => {
  // Check if isActive column exists, if not, get all locations
  let rows;
  try {
    rows = await prisma.location.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  } catch (error: any) {
    // If isActive column doesn't exist, get all locations
    if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
      rows = await prisma.location.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else {
      throw error;
    }
  }

  const propertyCounts = await prisma.property.groupBy({
    by: ['locationId'],
    where: {
      locationId: { not: null },
    },
    _count: {
      _all: true,
    },
  });

  const countMap = buildPropertyCountMap(
    propertyCounts.map((pc) => ({
      locationId: pc.locationId,
      _count: pc._count._all,
    }))
  );
  return buildLocationTree(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    countMap,
  );
};

export const getLocationById = (locationId: string) => {
  return prisma.location.findUnique({
    where: { id: locationId },
  });
};

export const getLocationChildren = async (parentId: string) => {
  try {
    return await prisma.location.findMany({
      where: { 
        parentId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  } catch (error: any) {
    // If isActive column doesn't exist, get all children
    if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
      return prisma.location.findMany({
        where: { 
          parentId,
        },
        orderBy: { name: 'asc' },
      });
    }
    throw error;
  }
};

export const searchLocations = async (query: string) => {
  if (!query.trim()) return [];
  try {
    return await prisma.location.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
      take: 50,
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
      },
    });
  } catch (error: any) {
    // If isActive column doesn't exist, search without it
    if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
      return prisma.location.findMany({
        where: {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        orderBy: {
          name: 'asc',
        },
        take: 50,
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true,
        },
      });
    }
    throw error;
  }
};

export const createLocation = async (input: {
  name: string;
  type: string;
  parentId?: string | null;
}) => {
  // Check if isLeaf/isActive columns exist
  let hasLeafColumns = true;
  try {
    // Try a test query to see if columns exist
    await prisma.$queryRaw`SELECT "isLeaf", "isActive" FROM "Location" LIMIT 1`;
  } catch {
    hasLeafColumns = false;
  }

  const basePayload = {
    name: normalizeName(input.name),
    type: normalizeType(input.type),
    parentId: input.parentId || null,
  };

  const payload = hasLeafColumns
    ? {
        ...basePayload,
        isLeaf: true, // New locations are leaf by default
        isActive: true,
      }
    : basePayload;

  if (payload.parentId) {
    const parent = await getLocationById(payload.parentId);
    if (!parent) {
      throw new Error('Parent location not found');
    }
    if (hasLeafColumns && (parent as any).isActive === false) {
      throw new Error('Cannot add child to inactive location');
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create the new location
      const newLocation = await tx.location.create({
        data: payload,
      });

      // If it has a parent and columns exist, mark parent as non-leaf
      if (payload.parentId && hasLeafColumns) {
        try {
          await tx.location.update({
            where: { id: payload.parentId },
            data: { isLeaf: false },
          });
        } catch {
          // Ignore if update fails (columns might not exist)
        }
      }

      return newLocation;
    });

    return result;
  } catch (error) {
    handleUniqueError(error);
  }
};

export const updateLocation = async (
  id: string,
  updates: { name?: string; type?: string; parentId?: string | null },
) => {
  // Check if isLeaf/isActive columns exist
  let hasLeafColumns = true;
  try {
    await prisma.$queryRaw`SELECT "isLeaf", "isActive" FROM "Location" LIMIT 1`;
  } catch {
    hasLeafColumns = false;
  }

  const normalized = {
    name: updates.name ? normalizeName(updates.name) : undefined,
    type: updates.type ? normalizeType(updates.type) : undefined,
    parentId: updates.parentId === undefined ? undefined : updates.parentId,
  };

  const current = await getLocationById(id);
  if (!current) {
    throw new Error('Location not found');
  }

  if (normalized.parentId) {
    const parent = await getLocationById(normalized.parentId);
    if (!parent) {
      throw new Error('Parent location not found');
    }
    if (parent.id === id) {
      throw new Error('Location cannot be its own parent');
    }
    if (hasLeafColumns && (parent as any).isActive === false) {
      throw new Error('Cannot move to inactive location');
    }

    const subtree = await getSubtreeIds(id);
    if (subtree.includes(normalized.parentId)) {
      throw new Error('Cannot move location inside its own subtree');
    }
  }

  try {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.location.update({
        where: { id },
        data: {
          ...(normalized.name ? { name: normalized.name } : {}),
          ...(normalized.type ? { type: normalized.type } : {}),
          ...(normalized.parentId !== undefined ? { parentId: normalized.parentId } : {}),
        },
      });

      // Handle parent changes for isLeaf logic
      if (normalized.parentId !== undefined && hasLeafColumns) {
        const oldParentId = current.parentId;
        const newParentId = normalized.parentId;

        // If moving to a new parent, mark new parent as non-leaf
        if (newParentId && newParentId !== oldParentId) {
          try {
            await tx.location.update({
              where: { id: newParentId },
              data: { isLeaf: false },
            });
          } catch {
            // Ignore if update fails
          }
        }

        // If old parent has no more children, mark it as leaf
        if (oldParentId && oldParentId !== newParentId) {
          try {
            const oldParentChildren = await tx.location.count({
              where: {
                parentId: oldParentId,
                isActive: true,
              },
            });
            if (oldParentChildren === 0) {
              await tx.location.update({
                where: { id: oldParentId },
                data: { isLeaf: true },
              });
            }
          } catch {
            // Ignore if columns don't exist
          }
        }
      }

      return updated;
    });
  } catch (error) {
    handleUniqueError(error);
  }
};

export const deleteLocation = async (id: string) => {
  // Check if isLeaf/isActive columns exist
  let hasLeafColumns = true;
  try {
    await prisma.$queryRaw`SELECT "isLeaf", "isActive" FROM "Location" LIMIT 1`;
  } catch {
    hasLeafColumns = false;
  }

  const location = await getLocationById(id);
  if (!location) {
    throw new Error('Location not found');
  }

  // Soft delete: set isActive = false
  return prisma.$transaction(async (tx) => {
    // Deactivate the location
    if (hasLeafColumns) {
      try {
        await tx.location.update({
          where: { id },
          data: { isActive: false },
        });
      } catch {
        // If columns don't exist, just delete the location
        await tx.location.delete({ where: { id } });
        return { message: 'Location deleted successfully' };
      }
    } else {
      // If columns don't exist, just delete the location
      await tx.location.delete({ where: { id } });
      return { message: 'Location deleted successfully' };
    }

    // Deactivate all related subsidiaries
    try {
      await tx.propertySubsidiary.updateMany({
        where: { locationId: id },
        data: { isActive: false },
      });
    } catch {
      // Ignore if isActive column doesn't exist on PropertySubsidiary
    }

    // If this location had a parent, check if parent should become leaf
    if (location.parentId && hasLeafColumns) {
      try {
        const parentChildren = await tx.location.count({
          where: {
            parentId: location.parentId,
            isActive: true,
          },
        });
        if (parentChildren === 0) {
          await tx.location.update({
            where: { id: location.parentId },
            data: { isLeaf: true },
          });
        }
      } catch {
        // Ignore if columns don't exist
      }
    }

    return { message: 'Location deactivated successfully' };
  });
};

export const getSubtreeIds = async (id: string): Promise<string[]> => {
  const rows = await fetchSubtreeRows(id);
  return rows.map((row) => row.id);
};

export const getLocationSubtree = async (locationId: string) => {
  const rows = await fetchSubtreeRows(locationId);
  if (rows.length === 0) {
    return null;
  }

  const propertyCounts = await prisma.property.groupBy({
    by: ['locationId'],
    where: {
      locationId: { in: rows.map((row) => row.id) },
    },
    _count: {
      _all: true,
    },
  });

  const countMap = buildPropertyCountMap(
    propertyCounts.map((pc) => ({
      locationId: pc.locationId,
      _count: pc._count._all,
    }))
  );
  const tree = buildLocationTree(rows, countMap);
  const subtreePropertyCount = await countPropertiesInSubtree(locationId);

  return {
    root: rows.find((row) => row.id === locationId) ?? null,
    tree,
    propertyCount: subtreePropertyCount,
  };
};

export const countPropertiesInSubtree = async (locationId: string) => {
  const query = Prisma.sql`
    WITH RECURSIVE subtree AS (
      SELECT "id"
      FROM "Location"
      WHERE "id" = ${locationId}
      UNION ALL
      SELECT l."id"
      FROM "Location" l
      JOIN subtree s ON l."parentId" = s."id"
    )
    SELECT COUNT(*) AS "count"
    FROM "Property"
    WHERE "locationId" IN (SELECT "id" FROM subtree);
  `;
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
  return Number(result[0]?.count ?? 0);
};

/**
 * Get all leaf locations (only selectable locations)
 * Returns locations with isLeaf = true AND isActive = true
 */
export const getLeafLocations = async () => {
  try {
    return await prisma.location.findMany({
      where: {
        isLeaf: true,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  } catch (error: any) {
    // If columns don't exist, return all locations (temporary fallback)
    if (error?.message?.includes('isLeaf') || error?.message?.includes('isActive') || error?.message?.includes('does not exist')) {
      return prisma.location.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    }
    throw error;
  }
};

/**
 * Build full path for a location (e.g., "Pakistan > Punjab > Lahore > DHA")
 * Only includes active locations in the path
 */
const buildLocationPathRecursive = async (locationId: string): Promise<string[]> => {
  // Check if isActive column exists
  let hasLeafColumns = true;
  try {
    await prisma.$queryRaw`SELECT "isActive" FROM "Location" LIMIT 1`;
  } catch {
    hasLeafColumns = false;
  }

  const location = await getLocationById(locationId);
  if (!location) {
    return [];
  }

  // Only check isActive if column exists
  if (hasLeafColumns && (location as any).isActive === false) {
    return [];
  }

  if (!location.parentId) {
    return [location.name];
  }

  const parentPath = await buildLocationPathRecursive(location.parentId);
  // Only add to path if parent path was successfully built (all parents are active)
  if (parentPath.length === 0) {
    return [];
  }
  return [...parentPath, location.name];
};

/**
 * Get all leaf locations with their full paths
 * Format: "Country > State > City > Area"
 * Only includes locations where all parents in the path are active
 */
export const getLeafLocationsWithPaths = async (): Promise<Array<{ id: string; path: string }>> => {
  const leafLocations = await getLeafLocations();
  
  const locationsWithPaths = await Promise.all(
    leafLocations.map(async (location) => {
      const path = await buildLocationPathRecursive(location.id);
      // Only include if path was successfully built (all parents are active)
      if (path.length === 0) {
        return null;
      }
      return {
        id: location.id,
        path: path.join(' > '),
      };
    })
  );

  // Filter out null entries (locations with inactive parents)
  const validPaths = locationsWithPaths.filter((item): item is { id: string; path: string } => item !== null);

  // Sort by path alphabetically
  validPaths.sort((a, b) => a.path.localeCompare(b.path));

  return validPaths;
};

