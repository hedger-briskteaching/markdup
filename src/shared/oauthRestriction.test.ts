import { describe, expect, it } from "vitest";
import {
  accessWarningFromApiError,
  formatOrgOauthRestrictionGuidance,
  formatOrgOauthRestrictionRichError,
  isOrgOauthRestrictionError,
  parseOrgFromOauthRestriction,
} from "./oauthRestriction";

const SAMPLE =
  "Although you appear to have the correct authorization credentials, the 'briskedu' organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited. For more information on these restrictions, including how to enable this app, visit https://docs.github.com/articles/restricting-access-to-your-organization-s-data/";

describe("oauthRestriction", () => {
  it("detects the GitHub org OAuth App restriction message", () => {
    expect(isOrgOauthRestrictionError(SAMPLE)).toBe(true);
    expect(isOrgOauthRestrictionError("Not Found")).toBe(false);
  });

  it("parses the organization login from the message", () => {
    expect(parseOrgFromOauthRestriction(SAMPLE)).toBe("briskedu");
    expect(parseOrgFromOauthRestriction("no org here")).toBeNull();
  });

  it("builds a settings-oriented access warning", () => {
    const warning = accessWarningFromApiError(SAMPLE);
    expect(warning).toEqual({
      kind: "oauth_org_restricted",
      org: "briskedu",
      message: formatOrgOauthRestrictionGuidance("briskedu"),
    });
    expect(warning?.message).toContain("briskedu");
    expect(warning?.message).toContain("Option 2");
  });

  it("builds a short rich-view error that points to Settings", () => {
    const text = formatOrgOauthRestrictionRichError("briskedu");
    expect(text).toContain("briskedu");
    expect(text).toContain("Settings");
    expect(text).toContain("personal access token");
    expect(text.length).toBeLessThan(SAMPLE.length);
  });
});
