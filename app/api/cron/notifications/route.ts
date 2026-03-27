import { NextRequest, NextResponse } from "next/server";

// GET/POST handler for notifications cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Example: Fetch pending notifications from your DB
    // Replace with your actual database logic
    console.log("Running notifications cron...");

    // TODO: Add your notification sending logic here

    return NextResponse.json({ success: true, message: "Notifications processed" });
  } catch (error) {
    console.error("Cron notifications error:", error);
    return NextResponse.json({ success: false, error: "Cron failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req); // Allow POST as well
}