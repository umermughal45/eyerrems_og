export const hasPermission = (
  permissions: string[] | undefined,
  isSuperAdmin: boolean | undefined,
  role: string | undefined,
  module: string,
  action?: string
): boolean => {
  // Admins always have full root access
  if (isSuperAdmin || role?.toLowerCase() === "admin") return true;

  // Empty permissions block everything implicitly
  if (!permissions || permissions.length === 0) return false;

  // Master override wildcard
  if (permissions.includes("*")) return true;

  // Module context check
  if (!action) {
    return permissions.some((p) => p.startsWith(`${module}.`));
  }

  // Exact endpoint check 
  const exactKey = `${module}.${action}`;
  if (permissions.includes(exactKey)) return true;

  // Hierarchy wildcards
  if (permissions.includes(`${module}.*`) || permissions.includes(module)) return true;

  return false;
};
