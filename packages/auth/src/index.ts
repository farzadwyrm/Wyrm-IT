export {
  type Actor,
  assertCan,
  can,
  check,
  type Decision,
  ForbiddenError,
  type ImpersonatingActor,
  type PlatformActor,
  type Resource,
  type TenantActor,
  type TenantRoleInfo,
} from "./can";
export {
  checkCustomRole,
  checkPlatformStaffChange,
  checkRoleChange,
  checkStaffLifecycle,
} from "./escalation";
export * from "./permissions";
