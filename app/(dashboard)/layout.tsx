"use client";

import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      setIsAuth(true);
    }
  }, [router]);

  if (!isAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#DADBDF]">
        <div className="animate-pulse text-primary font-medium">Verifying Access...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden p-3" style={{ backgroundColor: '#DADBDF' }}>
      <DashboardSidebar />
      <div className="flex-1 h-full overflow-hidden rounded-[2.5rem] bg-background shadow-md flex flex-col border border-black/5 ml-3">
        <main className="flex-1 h-full overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
