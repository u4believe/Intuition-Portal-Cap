// app/api/cron/notifications/route.ts

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("🔔 Running notifications cron...");

    // 👉 Call your push notification logic
    // Example:
    // await sendNotificationsToUsers();

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
}