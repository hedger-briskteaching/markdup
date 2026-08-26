import { describe, expect, it } from "vitest";
import { renderMarkdownBody } from "./markdownBody";

describe("renderMarkdownBody", () => {
  it("renders GitHub's raw HTML image comments", () => {
    const body = renderMarkdownBody(
      '<img width="2000" height="1068" alt="Image" src="https://private-user-images.githubusercontent.com/example.png?jwt=token" style="position: fixed" onerror="alert(1)">',
    );

    const image = body.querySelector<HTMLImageElement>("img");
    expect(image?.getAttribute("src")).toBe(
      "https://private-user-images.githubusercontent.com/example.png?jwt=token",
    );
    expect(image?.getAttribute("alt")).toBe("Image");
    expect(image?.getAttribute("width")).toBe("2000");
    expect(image?.getAttribute("height")).toBe("1068");
    expect(image?.hasAttribute("style")).toBe(false);
    expect(image?.hasAttribute("onerror")).toBe(false);
  });

  it("keeps rendering Markdown image comments", () => {
    const body = renderMarkdownBody("![Diagram](https://example.com/diagram.png)");

    const image = body.querySelector<HTMLImageElement>("img");
    expect(image?.getAttribute("src")).toBe("https://example.com/diagram.png");
    expect(image?.getAttribute("alt")).toBe("Diagram");
  });
});
