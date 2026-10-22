"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LuLogOut } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
      title="Keluar"
    >
      <LuLogOut size={15} />
      <span className="hidden sm:inline">{loading ? "Keluar..." : "Keluar"}</span>
    </Button>
  );
}
