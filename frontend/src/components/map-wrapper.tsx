"use client";

import { useEffect, useState } from "react";

export default function MapWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <p className="text-gray-400 text-sm">Loading map…</p>
      </div>
    );
  }

  return <>{children}</>;
}
