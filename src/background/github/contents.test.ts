import { describe, expect, it } from "vitest";
import { parsePullPath } from "../../background/github/contents";

describe("parsePullPath", () => {
  it("parses /changes and /files pull URLs", () => {
    expect(parsePullPath("/o/r/pull/12/changes")).toEqual({
      owner: "o",
      repo: "r",
      pullNumber: 12,
    });
    expect(parsePullPath("/o/r/pull/99/files")).toEqual({
      owner: "o",
      repo: "r",
      pullNumber: 99,
    });
  });

  it("rejects non-pull paths", () => {
    expect(parsePullPath("/o/r")).toBeNull();
    expect(parsePullPath("/o/r/issues/1")).toBeNull();
  });
});
