import { describe, expect, it } from "vitest";
import { commentBodyLengthError, GITHUB_COMMENT_BODY_MAX_LENGTH } from "./commentBody";

describe("commentBodyLengthError", () => {
  it("accepts GitHub's maximum body length", () => {
    expect(commentBodyLengthError("a".repeat(GITHUB_COMMENT_BODY_MAX_LENGTH))).toBeNull();
  });

  it("explains when a body is too long", () => {
    expect(commentBodyLengthError("a".repeat(GITHUB_COMMENT_BODY_MAX_LENGTH + 1))).toContain(
      "65,536",
    );
  });
});
