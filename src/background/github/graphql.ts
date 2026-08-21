import { githubFetch, GitHubApiError, formatGitHubErrorMessage } from "./client";

const GRAPHQL_URL = "https://api.github.com/graphql";

/**
 * Run a GitHub GraphQL query or mutation and return the `data` payload.
 * @param token - GitHub access token for authorization.
 * @param query - GraphQL query or mutation string.
 * @param variables - Optional variables passed to the query.
 * @returns The `data` field from the GraphQL response typed as T.
 */
export async function githubGraphql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new GitHubApiError(
      formatGitHubErrorMessage(response.status, parsed),
      response.status,
      parsed,
    );
  }

  const payload = parsed as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors && payload.errors.length > 0) {
    const message = payload.errors
      .map((e) => e.message)
      .filter((m): m is string => Boolean(m))
      .join(" ");
    throw new GitHubApiError(message || "GitHub GraphQL request failed", 200, parsed);
  }

  if (!payload.data) {
    throw new GitHubApiError("GitHub GraphQL returned no data", 200, parsed);
  }

  return payload.data;
}

/**
 * Get the GraphQL node ID for a pull request via the REST API.
 * REST is cheaper than a full GraphQL lookup for this single field.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param token - GitHub access token.
 * @returns The global GraphQL node ID string.
 */
export async function fetchPullRequestNodeId(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<string> {
  const pull = await githubFetch<{ node_id: string }>(
    `/repos/${owner}/${repo}/pulls/${pullNumber}`,
    { token },
  );
  if (!pull.node_id) {
    throw new Error("Could not resolve this pull request id.");
  }
  return pull.node_id;
}
