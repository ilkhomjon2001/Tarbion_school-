"use client";

import { LogoutIcon } from "@/components/ui/icons";
import { logout } from "@/lib/auth";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        void logout();
      }}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-danger transition-colors hover:bg-danger-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
    >
      <LogoutIcon className="h-4 w-4" />
      Ushbu qurilmadan chiqish
    </button>
  );
}
