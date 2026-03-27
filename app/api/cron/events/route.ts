// app/api/cron/events/route.ts

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("📡 Running events sync cron...");

    // 👉 Example:
    // fetch blockchain data
    // update database
    // poll APIs

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
}