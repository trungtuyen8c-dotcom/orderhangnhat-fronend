import { useAuth } from "../auth";

export function usePermission() {
  const { me } = useAuth();
  const isSuper = me?.roles.includes("super_admin") ?? false;
  const perms = me?.permissions ?? [];
  const can = (p: string) => isSuper || perms.includes("*") || perms.includes(p);
  return {
    can,
    canAny: (...ps: string[]) => ps.some(can),
    hasRole: (r: string) => me?.roles.includes(r) ?? false,
  };
}
