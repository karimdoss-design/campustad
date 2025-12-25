"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminMembersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/team-players");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-8">
      Redirecting...
    </div>
  );
}

