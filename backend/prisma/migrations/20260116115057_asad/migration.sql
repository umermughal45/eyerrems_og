-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "submodule" TEXT,
    "action" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorUsername" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "permissionPath" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB NOT NULL,
    "changeType" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "permissionUsed" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "requestPath" TEXT NOT NULL,
    "requestMethod" TEXT NOT NULL,
    "requestContext" JSONB,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_module_idx" ON "RolePermission"("module");

-- CreateIndex
CREATE INDEX "RolePermission_module_submodule_action_idx" ON "RolePermission"("module", "submodule", "action");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_module_submodule_action_key" ON "RolePermission"("roleId", "module", "submodule", "action");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_actorId_idx" ON "PermissionAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_roleId_idx" ON "PermissionAuditLog"("roleId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_permissionPath_idx" ON "PermissionAuditLog"("permissionPath");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_createdAt_idx" ON "PermissionAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActionAuditLog_userId_idx" ON "ActionAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ActionAuditLog_roleId_idx" ON "ActionAuditLog"("roleId");

-- CreateIndex
CREATE INDEX "ActionAuditLog_permissionUsed_idx" ON "ActionAuditLog"("permissionUsed");

-- CreateIndex
CREATE INDEX "ActionAuditLog_entityType_entityId_idx" ON "ActionAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActionAuditLog_createdAt_idx" ON "ActionAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
