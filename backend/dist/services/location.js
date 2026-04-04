"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeafLocationsWithPaths = exports.getLeafLocations = exports.countPropertiesInSubtree = exports.getLocationSubtree = exports.getSubtreeIds = exports.deleteLocation = exports.updateLocation = exports.createLocation = exports.searchLocations = exports.getLocationChildren = exports.getLocationById = exports.getLocationTree = void 0;
exports.buildLocationTree = buildLocationTree;
const client_1 = require("../prisma/client");
const client_2 = __importDefault(require("../prisma/client"));
const normalizeName = (value) => value.trim();
const normalizeType = (value) => value.trim().toLowerCase();
const handleUniqueError = (error) => {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') {
        throw new Error('Location with this name already exists under the parent level');
    }
    throw error;
};
const buildPropertyCountMap = (counts) => {
    return new Map(counts
        .filter((row) => row.locationId !== null)
        .map((row) => [row.locationId, row._count]));
};
function buildLocationTree(rows, propertyCountMap = new Map()) {
    const nodes = new Map();
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
    const roots = [];
    nodes.forEach((node) => {
        if (node.parentId && nodes.has(node.parentId)) {
            nodes.get(node.parentId)?.children.push(node);
        }
        else {
            roots.push(node);
        }
    });
    const sortNodes = (list) => {
        list.sort((a, b) => a.name.localeCompare(b.name));
        list.forEach((child) => sortNodes(child.children));
    };
    sortNodes(roots);
    return roots;
}
const fetchSubtreeRows = async (locationId) => {
    const query = client_1.Prisma.sql `
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
    return client_2.default.$queryRaw(query);
};
const getLocationTree = async () => {
    // Check if isActive column exists, if not, get all locations
    let rows;
    try {
        rows = await client_2.default.location.findMany({
            where: {
                isActive: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }
    catch (error) {
        // If isActive column doesn't exist, get all locations
        if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
            rows = await client_2.default.location.findMany({
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
        else {
            throw error;
        }
    }
    const propertyCounts = await client_2.default.property.groupBy({
        by: ['locationId'],
        where: {
            locationId: { not: null },
        },
        _count: {
            _all: true,
        },
    });
    const countMap = buildPropertyCountMap(propertyCounts.map((pc) => ({
        locationId: pc.locationId,
        _count: pc._count._all,
    })));
    return buildLocationTree(rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        parentId: row.parentId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    })), countMap);
};
exports.getLocationTree = getLocationTree;
const getLocationById = (locationId) => {
    return client_2.default.location.findUnique({
        where: { id: locationId },
    });
};
exports.getLocationById = getLocationById;
const getLocationChildren = async (parentId) => {
    try {
        return await client_2.default.location.findMany({
            where: {
                parentId,
                isActive: true,
            },
            orderBy: { name: 'asc' },
        });
    }
    catch (error) {
        // If isActive column doesn't exist, get all children
        if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
            return client_2.default.location.findMany({
                where: {
                    parentId,
                },
                orderBy: { name: 'asc' },
            });
        }
        throw error;
    }
};
exports.getLocationChildren = getLocationChildren;
const searchLocations = async (query) => {
    if (!query.trim())
        return [];
    try {
        return await client_2.default.location.findMany({
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
    }
    catch (error) {
        // If isActive column doesn't exist, search without it
        if (error?.message?.includes('isActive') || error?.message?.includes('isLeaf') || error?.message?.includes('does not exist')) {
            return client_2.default.location.findMany({
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
exports.searchLocations = searchLocations;
const createLocation = async (input) => {
    // Check if isLeaf/isActive columns exist
    let hasLeafColumns = true;
    try {
        // Try a test query to see if columns exist
        await client_2.default.$queryRaw `SELECT "isLeaf", "isActive" FROM "Location" LIMIT 1`;
    }
    catch {
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
        const parent = await (0, exports.getLocationById)(payload.parentId);
        if (!parent) {
            throw new Error('Parent location not found');
        }
        if (hasLeafColumns && parent.isActive === false) {
            throw new Error('Cannot add child to inactive location');
        }
    }
    try {
        const result = await client_2.default.$transaction(async (tx) => {
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
                }
                catch {
                    // Ignore if update fails (columns might not exist)
                }
            }
            return newLocation;
        });
        return result;
    }
    catch (error) {
        handleUniqueError(error);
    }
};
exports.createLocation = createLocation;
const updateLocation = async (id, updates) => {
    // Check if isLeaf/isActive columns exist
    let hasLeafColumns = true;
    try {
        await client_2.default.$queryRaw `SELECT "isLeaf", "isActive" FROM "Location" LIMIT 1`;
    }
    catch {
        hasLeafColumns = false;
    }
    const normalized = {
        name: updates.name ? normalizeName(updates.name) : undefined,
        type: updates.type ? normalizeType(updates.type) : undefined,
        parentId: updates.parentId === undefined ? undefined : updates.parentId,
    };
    const current = await (0, exports.getLocationById)(id);
    if (!current) {
        throw new Error('Location not found');
    }
    if (normalized.parentId) {
        const parent = await (0, exports.getLocationById)(normalized.parentId);
        if (!parent) {
            throw new Error('Parent location not found');
        }
        if (parent.id === id) {
            throw new Error('Location cannot be its own parent');
        }
        if (hasLeafColumns && parent.isActive === false) {
            throw new Error('Cannot move to inactive location');
        }
        const subtree = await (0, exports.getSubtreeIds)(id);
        if (subtree.includes(normalized.parentId)) {
            throw new Error('Cannot move location inside its own subtree');
        }
    }
    try {
        return client_2.default.$transaction(async (tx) => {
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
                    }
                    catch {
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
                    }
                    catch {
                        // Ignore if columns don't exist
                    }
                }
            }
            return updated;
        });
    }
    catch (error) {
        handleUniqueError(error);
    }
};
exports.updateLocation = updateLocation;
const deleteLocation = async (id) => {
    // Check if isLeaf/isActive columns exist
    let hasLeafColumns = true;
    try {
        await client_2.default.$queryRaw `SELECT "isLeaf", "isActive" FROM "Location" LIMIT 1`;
    }
    catch {
        hasLeafColumns = false;
    }
    const location = await (0, exports.getLocationById)(id);
    if (!location) {
        throw new Error('Location not found');
    }
    // Soft delete: set isActive = false
    return client_2.default.$transaction(async (tx) => {
        // Deactivate the location
        if (hasLeafColumns) {
            try {
                await tx.location.update({
                    where: { id },
                    data: { isActive: false },
                });
            }
            catch {
                // If columns don't exist, just delete the location
                await tx.location.delete({ where: { id } });
                return { message: 'Location deleted successfully' };
            }
        }
        else {
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
        }
        catch {
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
            }
            catch {
                // Ignore if columns don't exist
            }
        }
        return { message: 'Location deactivated successfully' };
    });
};
exports.deleteLocation = deleteLocation;
const getSubtreeIds = async (id) => {
    const rows = await fetchSubtreeRows(id);
    return rows.map((row) => row.id);
};
exports.getSubtreeIds = getSubtreeIds;
const getLocationSubtree = async (locationId) => {
    const rows = await fetchSubtreeRows(locationId);
    if (rows.length === 0) {
        return null;
    }
    const propertyCounts = await client_2.default.property.groupBy({
        by: ['locationId'],
        where: {
            locationId: { in: rows.map((row) => row.id) },
        },
        _count: {
            _all: true,
        },
    });
    const countMap = buildPropertyCountMap(propertyCounts.map((pc) => ({
        locationId: pc.locationId,
        _count: pc._count._all,
    })));
    const tree = buildLocationTree(rows, countMap);
    const subtreePropertyCount = await (0, exports.countPropertiesInSubtree)(locationId);
    return {
        root: rows.find((row) => row.id === locationId) ?? null,
        tree,
        propertyCount: subtreePropertyCount,
    };
};
exports.getLocationSubtree = getLocationSubtree;
const countPropertiesInSubtree = async (locationId) => {
    const query = client_1.Prisma.sql `
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
    const result = await client_2.default.$queryRaw(query);
    return Number(result[0]?.count ?? 0);
};
exports.countPropertiesInSubtree = countPropertiesInSubtree;
/**
 * Get all leaf locations (only selectable locations)
 * Returns locations with isLeaf = true AND isActive = true
 */
const getLeafLocations = async () => {
    try {
        return await client_2.default.location.findMany({
            where: {
                isLeaf: true,
                isActive: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }
    catch (error) {
        // If columns don't exist, return all locations (temporary fallback)
        if (error?.message?.includes('isLeaf') || error?.message?.includes('isActive') || error?.message?.includes('does not exist')) {
            return client_2.default.location.findMany({
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
exports.getLeafLocations = getLeafLocations;
/**
 * Build full path for a location (e.g., "Pakistan > Punjab > Lahore > DHA")
 * Only includes active locations in the path
 */
const buildLocationPathRecursive = async (locationId) => {
    // Check if isActive column exists
    let hasLeafColumns = true;
    try {
        await client_2.default.$queryRaw `SELECT "isActive" FROM "Location" LIMIT 1`;
    }
    catch {
        hasLeafColumns = false;
    }
    const location = await (0, exports.getLocationById)(locationId);
    if (!location) {
        return [];
    }
    // Only check isActive if column exists
    if (hasLeafColumns && location.isActive === false) {
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
const getLeafLocationsWithPaths = async () => {
    const leafLocations = await (0, exports.getLeafLocations)();
    const locationsWithPaths = await Promise.all(leafLocations.map(async (location) => {
        const path = await buildLocationPathRecursive(location.id);
        // Only include if path was successfully built (all parents are active)
        if (path.length === 0) {
            return null;
        }
        return {
            id: location.id,
            path: path.join(' > '),
        };
    }));
    // Filter out null entries (locations with inactive parents)
    const validPaths = locationsWithPaths.filter((item) => item !== null);
    // Sort by path alphabetically
    validPaths.sort((a, b) => a.path.localeCompare(b.path));
    return validPaths;
};
exports.getLeafLocationsWithPaths = getLeafLocationsWithPaths;
//# sourceMappingURL=location.js.map