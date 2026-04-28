import type { Bindings } from "./index.js";

type AgentRow = {
  id: string;
  display_name: string;
  description: string | null;
  base_url: string;
  manifest_url: string;
  tier: string;
  supported_item_types: string;
  regions: string | null;
  tags: string | null;
  health_status: string;
  last_verified_at: number | null;
  created_at: number;
};

export interface MirrorAgent {
  agentId: string;
  displayName: string;
  description?: string;
  baseUrl: string;
  manifestUrl: string;
  tier: string;
  supportedItemTypes: string[];
  regions?: unknown[];
  publicKey: null;
  badgeUrl: string | null;
  tags?: string[];
  addedAt: string;
  verified: true;
  health: string;
  lastVerifiedAt: string | null;
}

export interface MirrorPayload {
  $schema: "./schema.json";
  version: "0.1";
  updated: string;
  agents: MirrorAgent[];
}

const dateOf = (unix: number): string => new Date(unix * 1000).toISOString().slice(0, 10);

const dateTimeOf = (unix: number | null): string | null =>
  unix == null ? null : new Date(unix * 1000).toISOString();

function rowToMirrorAgent(row: AgentRow, publicBaseUrl: string): MirrorAgent {
  const itemTypes = JSON.parse(row.supported_item_types) as string[];
  const regionsRaw = row.regions ? (JSON.parse(row.regions) as unknown[]) : [];
  const tagsRaw = row.tags ? (JSON.parse(row.tags) as string[]) : [];
  const regions = regionsRaw.length > 0 ? regionsRaw : undefined;
  const tags = tagsRaw.length > 0 ? tagsRaw : undefined;
  const out: MirrorAgent = {
    agentId: row.id,
    displayName: row.display_name,
    baseUrl: row.base_url,
    manifestUrl: row.manifest_url,
    tier: row.tier,
    supportedItemTypes: itemTypes,
    publicKey: null,
    badgeUrl: `${publicBaseUrl}/v1/agents/${row.id}/badge`,
    addedAt: dateOf(row.created_at),
    verified: true,
    health: row.health_status,
    lastVerifiedAt: dateTimeOf(row.last_verified_at),
  };
  if (row.description) out.description = row.description;
  if (regions !== undefined) out.regions = regions;
  if (tags !== undefined) out.tags = tags;
  return out;
}

export async function buildMirrorPayload(env: Bindings, today: string): Promise<MirrorPayload> {
  const { results } = await env.DB.prepare(
    `SELECT id, display_name, description, base_url, manifest_url, tier, supported_item_types,
              regions, tags, health_status, last_verified_at, created_at
         FROM agents
        WHERE verification_status = 'verified' AND health_status != 'delisted'
        ORDER BY id ASC`,
  ).all<AgentRow>();
  return {
    $schema: "./schema.json",
    version: "0.1",
    updated: today,
    agents: results.map((r) => rowToMirrorAgent(r, env.PUBLIC_BASE_URL)),
  };
}

const GH = "https://api.github.com";

async function gh<T>(env: Bindings, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${GH}${path}`, {
    method,
    headers: {
      Authorization: `token ${env.GITHUB_BOT_PAT}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "openkarta-registry-cron",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    throw new Error(`github ${method} ${path} ${r.status}: ${await r.text()}`);
  }
  return (await r.json()) as T;
}

export interface MirrorResult {
  commitSha: string;
  branch: string;
  agentsCount: number;
}

export async function gitMirrorSnapshot(env: Bindings): Promise<MirrorResult> {
  const today = new Date().toISOString().slice(0, 10);
  const payload = await buildMirrorPayload(env, today);
  const content = `${JSON.stringify(payload, null, 2)}\n`;

  const branch = env.GIT_MIRROR_BRANCH;
  const repo = env.GITHUB_REPO;

  // 1. Get the ref (mirror branch if exists, else fall back to main).
  let parentSha: string;
  try {
    const ref = await gh<{ object: { sha: string } }>(
      env,
      "GET",
      `/repos/${repo}/git/refs/heads/${branch}`,
    );
    parentSha = ref.object.sha;
  } catch {
    const main = await gh<{ object: { sha: string } }>(
      env,
      "GET",
      `/repos/${repo}/git/refs/heads/main`,
    );
    parentSha = main.object.sha;
    // Create the branch from main.
    await gh(env, "POST", `/repos/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: parentSha,
    });
  }

  // 2. Get the parent commit's tree sha.
  const parentCommit = await gh<{ tree: { sha: string } }>(
    env,
    "GET",
    `/repos/${repo}/git/commits/${parentSha}`,
  );
  const baseTreeSha = parentCommit.tree.sha;

  // 3. Create a blob for the new file content.
  const blob = await gh<{ sha: string }>(env, "POST", `/repos/${repo}/git/blobs`, {
    content,
    encoding: "utf-8",
  });

  // 4. Create a new tree with the blob at registry/agents.json.
  const tree = await gh<{ sha: string }>(env, "POST", `/repos/${repo}/git/trees`, {
    base_tree: baseTreeSha,
    tree: [
      {
        path: "registry/agents.json",
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      },
    ],
  });

  // 5. Create a commit pointing to the new tree.
  const commit = await gh<{ sha: string }>(env, "POST", `/repos/${repo}/git/commits`, {
    message: `chore(registry): mirror snapshot ${today}`,
    tree: tree.sha,
    parents: [parentSha],
    author: { name: "openkarta-bot", email: "bot@openkarta.org", date: new Date().toISOString() },
  });

  // 6. Update the branch ref to the new commit.
  await gh(env, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, {
    sha: commit.sha,
    force: false,
  });

  return { commitSha: commit.sha, branch, agentsCount: payload.agents.length };
}
