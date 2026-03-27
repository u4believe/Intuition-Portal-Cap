import { NextRequest, NextResponse } from "next/server";

// GET/POST handler for events cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Example: Fetch pending events or perform scheduled tasks
    console.log("Running events cron...");

    // TODO: Add your scheduled task logic here

    return NextResponse.json({ success: true, message: "Events processed" });
  } catch (error) {
    console.error("Cron events error:", error);
    return NextResponse.json({ success: false, error: "Cron failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req); // Allow POST as well
}