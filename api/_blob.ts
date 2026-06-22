import { del, list, type ListBlobResultBlob } from "@vercel/blob";

export async function listAllBlobs(prefix: string, token: string, max = 10_000): Promise<ListBlobResultBlob[]> {
  const all: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: Math.min(1000, max - all.length) });
    all.push(...page.blobs);
    if (all.length >= max && page.hasMore) throw new Error(`blob list exceeds ${max}`);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
}

/** Prefix 아래 blob을 메모리에 전부 쌓지 않고 페이지 단위로 삭제한다. */
export async function deleteAllBlobs(prefix: string, token: string, max = 100_000): Promise<number> {
  let removed = 0;
  while (removed < max) {
    const page = await list({ prefix, token, limit: Math.min(1000, max - removed) });
    if (page.blobs.length === 0) return removed;
    for (let index = 0; index < page.blobs.length; index += 500) {
      await del(page.blobs.slice(index, index + 500).map((blob) => blob.url), { token });
    }
    removed += page.blobs.length;
    if (!page.hasMore) return removed;
  }
  throw new Error(`blob delete exceeds ${max}`);
}
