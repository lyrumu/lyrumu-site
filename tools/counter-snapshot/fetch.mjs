import { readFile, mkdir, writeFile, rename } from "node:fs/promises";

const config = await readFile("hugo.toml", "utf8");
const section = config.match(/\[params\.firebase\]([\s\S]*?)(?=\n\s*\[|$)/)?.[1];
const field = name => section?.match(new RegExp(`^\\s*${name}\\s*=\\s*'([^']+)'`, "m"))?.[1];
const apiKey = field("apiKey"), projectId = field("projectId");
if (!apiKey || !projectId) throw new Error("Firebase configuration missing");

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Firebase request failed (${response.status})`);
  return response.json();
}

const auth = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.idToken) throw new Error("Firebase authentication returned no token");
const counts = {};
for (const collection of ["views", "likes"]) {
  let pageToken;
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collection}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await request(url, { headers: { Authorization: `Bearer ${auth.idToken}` } });
    for (const doc of page.documents || []) {
      const id = decodeURIComponent(doc.name.split("/").pop());
      const raw = doc.fields?.[collection]?.integerValue;
      const value = Number(raw);
      if (!id.startsWith(collection + "_") || typeof raw !== "string" || !/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
        throw new Error(`Invalid ${collection} document`);
      }
      counts[id] = value;
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
}
await mkdir("data", { recursive: true });
await writeFile("data/counter_snapshot.json.tmp", JSON.stringify({ counts, generatedAt: new Date().toISOString() }));
await rename("data/counter_snapshot.json.tmp", "data/counter_snapshot.json");
console.log(`Counter snapshot prepared: ${Object.keys(counts).length} documents`);
