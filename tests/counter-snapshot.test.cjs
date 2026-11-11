const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

function run(fail) {
  const dir = mkdtempSync(join(tmpdir(), "counter-snapshot-"));
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "hugo.toml"), "[params.firebase]\napiKey = 'test'\nprojectId = 'test'\n");
  writeFileSync(join(dir, "data/counter_snapshot.json"), '{"old":true}');
  writeFileSync(join(dir, "mock.mjs"), `
    globalThis.fetch = async url => {
      if (String(url).includes('accounts:signUp')) return { ok: true, json: async () => ({ idToken: 'token' }) };
      if (${fail}) return { ok: false, status: 503 };
      const u = new URL(url);
      const likes = u.pathname.endsWith('/likes');
      const id = likes ? 'likes_home' : (u.searchParams.has('pageToken') ? 'views_second' : 'views_home');
      return { ok: true, json: async () => ({ documents: [{ name: 'x/' + id, fields: { [likes ? 'likes' : 'views']: { integerValue: '12' } } }], ...(!likes && !u.searchParams.has('pageToken') ? { nextPageToken: 'next' } : {}) }) };
    };`);
  const result = spawnSync(process.execPath, ["--import", join(dir, "mock.mjs"), resolve(__dirname, "../tools/counter-snapshot/fetch.mjs")], { cwd: dir, encoding: "utf8" });
  const snapshot = JSON.parse(readFileSync(join(dir, "data/counter_snapshot.json"), "utf8"));
  rmSync(dir, { recursive: true, force: true });
  return { result, snapshot };
}

test("build snapshot reads every collection page", () => {
  const { result, snapshot } = run(false);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot.counts, { views_home: 12, views_second: 12, likes_home: 12 });
});

test("failed fetch keeps the previous snapshot intact", () => {
  const { result, snapshot } = run(true);
  assert.notEqual(result.status, 0);
  assert.deepEqual(snapshot, { old: true });
});
