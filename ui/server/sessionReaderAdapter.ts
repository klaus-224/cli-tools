import { spawn } from "node:child_process";
import { normalizeSessionList, normalizeTranscript } from "./normalize";
import type {
  ApiErrorPayload,
  SessionQuery,
  SessionSummary,
  SessionTranscript,
} from "./types";

const SESSION_READER_BIN = process.env.SESSION_READER_BIN ?? "session_reader";

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const runCommand = (args: string[]): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(SESSION_READER_BIN, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });
  });

const tryParseJson = (text: string): unknown => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const runCommandVariants = async (
  variants: string[][],
): Promise<CommandResult> => {
  let lastResult: CommandResult | null = null;

  for (const args of variants) {
    const result = await runCommand(args);
    lastResult = result;
    if (result.exitCode === 0) return result;
  }

  if (!lastResult) {
    throw new Error("Failed to run session_reader");
  }

  throw new Error(
    lastResult.stderr.trim() ||
      `session_reader exited with code ${lastResult.exitCode}`,
  );
};

const buildTranscriptArgs = (sessionId: string): string[][] => [
  ["transcript", sessionId],
  ["transcript", "--session-id", sessionId],
];

const matchesFilter = (
  value: string | null | undefined,
  query: string,
): boolean => {
  if (!query) return true;
  return (value ?? "").toLowerCase().includes(query.toLowerCase());
};

const filterSessions = (
  sessions: SessionSummary[],
  query: SessionQuery,
): SessionSummary[] =>
  sessions.filter((session) => {
    if (!matchesFilter(session.id, query.session_id)) return false;
    if (!matchesFilter(session.slug ?? session.title, query.session_id))
      return false;
    if (!matchesFilter(session.agent, query.agent)) return false;
    if (!matchesFilter(session.directory, query.directory)) return false;
    return true;
  });

const parseListResult = (output: unknown): SessionSummary[] => {
  if (typeof output === "string")
    return normalizeSessionList(tryParseJson(output));
  return normalizeSessionList(output);
};

export const readSessions = async (
  query: SessionQuery,
): Promise<SessionSummary[]> => {
  try {
    const result = await runCommand(["list", "--limit", "200"]);
    const sessions = filterSessions(
      parseListResult(tryParseJson(result.stdout)),
      query,
    );
    return sessions.slice(0, query.limit);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to query sessions",
    );
  }
};

export const readTranscript = async (
  sessionId: string,
): Promise<SessionTranscript> => {
  try {
    const result = await runCommandVariants(buildTranscriptArgs(sessionId));
    return normalizeTranscript(tryParseJson(result.stdout), sessionId);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to query transcript",
    );
  }
};

export const adapterErrorPayload = (
  message: string,
  details?: unknown,
): ApiErrorPayload => ({
  error: {
    message,
    details,
  },
});
