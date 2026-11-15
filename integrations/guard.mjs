// Exact field names that carry a prompt, an answer, a document, or a client name.
// A count such as "Number of documents", or "Client Matter #", is not one of these.
const CONTENT = new Set([
  "prompt",
  "query",
  "response",
  "document",
  "documents",
  "file",
  "filename",
  "file_name",
  "client",
  "client_name",
  "clientname",
  "message",
  "messages",
  "content",
]);

export function assertNoContent(record, source) {
  for (const key of Object.keys(record ?? {})) {
    const normalized = key.toLowerCase().replace(/[\s-]+/g, "_");
    if (CONTENT.has(normalized)) {
      throw new Error(`${source} field "${key}" is not kept.`);
    }
  }
}
