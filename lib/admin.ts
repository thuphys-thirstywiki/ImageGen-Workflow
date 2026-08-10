/** Shared admin gate for destructive / privileged actions. */
export function getAdminPassword(): string {
  return (process.env["ADMIN_PASSWORD"] || "").trim();
}

export function assertAdminPassword(password: unknown): void {
  const required = getAdminPassword();
  if (!required) {
    throw new Error("服务器未配置 ADMIN_PASSWORD");
  }
  const given = typeof password === "string" ? password.trim() : "";
  if (!given || given !== required) {
    throw new Error("管理员密码错误");
  }
}
