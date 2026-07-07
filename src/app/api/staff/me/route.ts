import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireStaffAuth(request, "orders:read");
  if (!auth.ok) return auth.response;

  const { profile } = auth.ctx;
  return NextResponse.json({
    role: profile.role,
    full_name: profile.full_name,
    restaurant_id: profile.restaurant_id
  });
}
