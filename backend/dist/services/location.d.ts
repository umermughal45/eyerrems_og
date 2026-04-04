import { Prisma } from '../prisma/client';
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
export declare function buildLocationTree(rows: LocationRow[], propertyCountMap?: Map<string, number>): LocationTreeNode[];
export declare const getLocationTree: () => Promise<LocationTreeNode[]>;
export declare const getLocationById: (locationId: string) => Prisma.Prisma__LocationClient<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    parentId: string | null;
    isLeaf: boolean;
} | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
export declare const getLocationChildren: (parentId: string) => Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    parentId: string | null;
    isLeaf: boolean;
}[]>;
export declare const searchLocations: (query: string) => Promise<{
    type: string;
    name: string;
    id: string;
    parentId: string | null;
}[]>;
export declare const createLocation: (input: {
    name: string;
    type: string;
    parentId?: string | null;
}) => Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    parentId: string | null;
    isLeaf: boolean;
} | undefined>;
export declare const updateLocation: (id: string, updates: {
    name?: string;
    type?: string;
    parentId?: string | null;
}) => Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    parentId: string | null;
    isLeaf: boolean;
} | undefined>;
export declare const deleteLocation: (id: string) => Promise<{
    message: string;
}>;
export declare const getSubtreeIds: (id: string) => Promise<string[]>;
export declare const getLocationSubtree: (locationId: string) => Promise<{
    root: LocationRow | null;
    tree: LocationTreeNode[];
    propertyCount: number;
} | null>;
export declare const countPropertiesInSubtree: (locationId: string) => Promise<number>;
/**
 * Get all leaf locations (only selectable locations)
 * Returns locations with isLeaf = true AND isActive = true
 */
export declare const getLeafLocations: () => Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    parentId: string | null;
}[]>;
/**
 * Get all leaf locations with their full paths
 * Format: "Country > State > City > Area"
 * Only includes locations where all parents in the path are active
 */
export declare const getLeafLocationsWithPaths: () => Promise<Array<{
    id: string;
    path: string;
}>>;
//# sourceMappingURL=location.d.ts.map