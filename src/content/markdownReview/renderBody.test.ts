import { beforeEach, describe, expect, it } from "vitest";
import { alignMarkdown } from "../../markdown/align";
import { buildRichBody } from "./renderBody";

describe("buildRichBody", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders a raw HTML image in the rich view", () => {
    const markdown =
      '<img width="2000" height="1068" alt="Image" src="https://private-user-images.githubusercontent.com/example.png?jwt=token" style="position: fixed" class="js-gh-image-fallback" onerror="alert(1)">\n';
    const body = buildRichBody(alignMarkdown("", markdown), new Set());

    const image = body.querySelector<HTMLImageElement>(".rgm-rich-cell-after img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe(
      "https://private-user-images.githubusercontent.com/example.png?jwt=token",
    );
    expect(image?.getAttribute("alt")).toBe("Image");
    expect(image?.getAttribute("width")).toBe("2000");
    expect(image?.getAttribute("height")).toBe("1068");
    expect(image?.hasAttribute("style")).toBe(false);
    expect(image?.hasAttribute("class")).toBe(false);
    expect(image?.hasAttribute("onerror")).toBe(false);
  });

  it("does not render arbitrary raw HTML", () => {
    const markdown = '<script src="https://example.com/bad.js"></script>\n';
    const body = buildRichBody(alignMarkdown("", markdown), new Set());

    expect(body.querySelector("script")).toBeNull();
  });
});
