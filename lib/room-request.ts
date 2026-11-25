/** Read a bounded body even when Content-Length is missing (chunked requests). */
export async function roomBody(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    new URL(origin).host !== request.headers.get("host")
  )
    throw new Error("Cross-origin request blocked");
  return JSON.parse(await boundedText(request));
}

export async function boundedText(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024 * 1024) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
