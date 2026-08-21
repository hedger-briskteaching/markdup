import { githubFetch } from "./client";
import { getAccessToken } from "./auth";
import { commentableToDto, type CommentableLinesDto } from "../../shared/commentableLines";
import { fetchCommentableLines } from "./pulls";

export type PullRefs = {
  owner: string;
  repo: string;
  pullNumber: number;
  baseSha: string;
  headSha: string;
};

export type FileSnapshot = {
  owner: string;
  repo: string;
  pullNumber: number;
  path: string;
  baseSha: string;
  headSha: string;
  baseText: string | null;
  headText: string | null;
  /** Lines GitHub accepts for LEFT/RIGHT review comments. */
  commentable: CommentableLinesDto;
};

type PullResponse = {
  base: { sha: string };
  head: { sha: string };
};

type ContentFileResponse = {
  type: "file";
  encoding: string;
  content: string;
  sha: string;
};

/**
 * Extract owner, repo, and pull number from a GitHub pull request URL path.
 * @param pathname - The URL pathname (for example `/owner/repo/pull/42/files`).
 * @returns Parsed components, or null if the path does not match.
 */
export function parsePullPath(
  pathname: string,
): { owner: string; repo: string; pullNumber: number } | null {
  const match = pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/(?:changes|files)(?:\/.*)?)?\/?$/,
  );
  if (!match) {
    return null;
  }
  return {
    owner: match[1]!,
    repo: match[2]!,
    pullNumber: Number(match[3]),
  };
}

/**
 * Fetch the base and head commit SHAs for a pull request.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param token - GitHub access token.
 * @returns PullRefs containing the owner, repo, pull number, and SHAs.
 */
export async function fetchPullRefs(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<PullRefs> {
  const pull = await githubFetch<PullResponse>(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
    token,
  });
  return {
    owner,
    repo,
    pullNumber,
    baseSha: pull.base.sha,
    headSha: pull.head.sha,
  };
}

/**
 * Fetch the text content of a file at a specific git ref.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param path - File path within the repository.
 * @param ref - Git ref (SHA, branch, or tag) to read from.
 * @param token - GitHub access token.
 * @returns The decoded file text, or null if the file does not exist at that ref.
 */
export async function fetchFileTextAtRef(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token: string,
): Promise<string | null> {
  try {
    const data = await githubFetch<ContentFileResponse | ContentFileResponse[]>(
      `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
      { token },
    );
    if (Array.isArray(data) || data.type !== "file") {
      return null;
    }
    if (data.encoding !== "base64" || typeof data.content !== "string") {
      return null;
    }
    return decodeBase64(data.content);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status: number }).status === 404
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Load the full file snapshot for a Markdown file in a pull request.
 * Fetches both base and head text plus commentable line ranges in parallel.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path within the repository.
 * @returns A complete FileSnapshot with base text, head text, and commentable lines.
 */
export async function fetchFileSnapshot(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
): Promise<FileSnapshot> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Connect to GitHub before you open the rich view.");
  }

  const refs = await fetchPullRefs(owner, repo, pullNumber, token);
  const [baseText, headText, commentable] = await Promise.all([
    fetchFileTextAtRef(owner, repo, path, refs.baseSha, token),
    fetchFileTextAtRef(owner, repo, path, refs.headSha, token),
    fetchCommentableLines(owner, repo, pullNumber, path, token),
  ]);

  return {
    owner,
    repo,
    pullNumber,
    path,
    baseSha: refs.baseSha,
    headSha: refs.headSha,
    baseText,
    headText,
    commentable: commentableToDto(commentable),
  };
}

/**
 * URI-encode each segment of a file path individually.
 * @param path - Slash-separated file path.
 * @returns Encoded path safe for use in GitHub API URLs.
 */
function encodePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/**
 * Decode a base64-encoded string into UTF-8 text.
 * @param content - Base64 string (newlines are stripped before decoding).
 * @returns The decoded UTF-8 text.
 */
function decodeBase64(content: string): string {
  const cleaned = content.replace(/\n/g, "");
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
