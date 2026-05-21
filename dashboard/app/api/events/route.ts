import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = async () => {
        if (closed) return;
        const snapshot = await buildSnapshot();
        controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
      };

      await send();
      const interval = setInterval(send, 5000);

      setTimeout(() => {
        closed = true;
        clearInterval(interval);
        controller.close();
      }, 1000 * 60 * 15);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

