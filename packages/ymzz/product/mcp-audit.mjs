// MIT. Read-only audit surface over the NATIVE DSH MCP manager and tool registry.
// This module never writes configuration: it lists, probes and restarts only.
import {assert} from './guard.mjs';

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

/**
 * Resolve `ctx.mcpManager` without assuming the service is mounted. A missing
 * capability must degrade to a readable status, never throw at plugin load.
 * @param {object} ctx - Host plugin context.
 * @returns {object|null} the native manager, or `null` when unavailable.
 */
export function resolveMcpManager(ctx) {
  if (!ctx) return null;
  try {
    const direct = ctx.mcpManager;
    if (direct && typeof direct.list === 'function') return direct;
  } catch {}
  try {
    if (typeof ctx.get === 'function') {
      const viaGet = ctx.get('mcpManager');
      if (viaGet && typeof viaGet.list === 'function') return viaGet;
    }
  } catch {}
  return null;
}

/** Turn one native status union member into a stable label. */
function statusLabel(status) {
  if (!status || typeof status !== 'object') return 'idle';
  const state = typeof status.state === 'string' ? status.state : 'unknown';
  if (state === 'failed') return `failed${typeof status.reason === 'string' ? `:${status.reason}` : ''}`;
  if (state === 'closed') return 'closed';
  if (state === 'connected') return 'connected';
  return state;
}

/**
 * Count registered tools, including the `mcp__` namespace contributed by MCP.
 * @param {object} ctx - Host plugin context.
 * @returns {{total: number, mcp: number}} tool counts, zero when unavailable.
 */
export function toolCounts(ctx) {
  try {
    const tools = ctx?.tools;
    if (!tools || typeof tools.definitions !== 'function') return {total: 0, mcp: 0};
    const definitions = tools.definitions();
    if (!Array.isArray(definitions)) return {total: 0, mcp: 0};
    return {
      total: definitions.length,
      mcp: definitions.filter((definition) => String(definition?.name ?? '').startsWith('mcp__')).length,
    };
  } catch {
    return {total: 0, mcp: 0};
  }
}

/**
 * Snapshot the native MCP surface. `available: false` means the native service
 * is not composed in this Host; the panel then shows a plain explanation and
 * points at native DSH Settings instead of offering configuration writes.
 * @param {object} ctx - Host plugin context.
 * @returns {{available: boolean, reason: string, servers: object[], tools: {total: number, mcp: number}}} status.
 */
export function mcpSnapshot(ctx) {
  const tools = toolCounts(ctx);
  const manager = resolveMcpManager(ctx);
  if (!manager) {
    return {available: false, reason: 'NATIVE_SERVICE_DISABLED', servers: [], tools};
  }
  try {
    const list = manager.list();
    const servers = (Array.isArray(list) ? list : []).map((view) => ({
      name: String(view?.name ?? ''),
      configured: view?.configured !== false,
      status: statusLabel(view?.status),
    }));
    return {available: true, reason: '', servers, tools};
  } catch (error) {
    return {
      available: false,
      reason: 'MCP_LIST_FAILED',
      detail: typeof error?.message === 'string' ? error.message.slice(0, 200) : '',
      servers: [],
      tools,
    };
  }
}

/** Validate a server name coming from the panel before touching the manager. */
function assertName(name) {
  assert(typeof name === 'string' && NAME_PATTERN.test(name), 'MCP_SERVER_NAME_INVALID');
  return name;
}

/**
 * Probe one configured or registered server without changing live instances.
 * @param {object} ctx - Host plugin context.
 * @param {unknown} name - server key.
 * @returns {Promise<object>} probe outcome summary.
 */
export async function probeServer(ctx, name) {
  const manager = resolveMcpManager(ctx);
  assert(manager, 'NATIVE_SERVICE_DISABLED');
  assert(typeof manager.probe === 'function', 'NATIVE_SERVICE_DISABLED');
  const server = assertName(name);
  const result = await manager.probe(server, {signal: AbortSignal.timeout(15000)});
  if (result && result.ok === true) {
    return {
      ok: true,
      name: server,
      toolNames: Array.isArray(result.toolNames) ? result.toolNames.slice(0, 64).map(String) : [],
      truncated: Boolean(result.truncated),
      durationMs: Number(result.durationMs) || 0,
      cleanup: result.cleanup ? statusLabel(result.cleanup) : 'closed',
    };
  }
  return {
    ok: false,
    name: server,
    stage: typeof result?.stage === 'string' ? result.stage : 'connect',
    message: typeof result?.message === 'string' ? result.message.slice(0, 400) : 'MCP_PROBE_FAILED',
    durationMs: Number(result?.durationMs) || 0,
  };
}

/**
 * Ask the native manager to restart one server. Configuration is untouched:
 * the entry still comes from native DSH Settings.
 * @param {object} ctx - Host plugin context.
 * @param {unknown} name - server key.
 * @returns {Promise<{ok: true, name: string}>} restart acknowledgement.
 */
export async function restartServer(ctx, name) {
  const manager = resolveMcpManager(ctx);
  assert(manager, 'NATIVE_SERVICE_DISABLED');
  assert(typeof manager.restart === 'function', 'NATIVE_SERVICE_DISABLED');
  const server = assertName(name);
  await manager.restart(server);
  return {ok: true, name: server};
}
