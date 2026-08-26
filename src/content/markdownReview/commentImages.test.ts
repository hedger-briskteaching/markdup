import { afterEach, describe, expect, it, vi } from "vitest";
import { compressCommentImage, pastedImageFiles } from "./commentImages";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pastedImageFiles", () => {
  it("keeps only image files", () => {
    const image = new File(["image"], "screenshot.png", { type: "image/png" });
    const text = new File(["text"], "notes.txt", { type: "text/plain" });
    const event = { clipboardData: { files: [image, text] } } as unknown as ClipboardEvent;

    expect(pastedImageFiles(event)).toEqual([image]);
  });
});

describe("compressCommentImage", () => {
  it("caps dimensions and reduces quality until the data URL fits", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 2400, height: 1200, close }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const toDataUrl = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockImplementation((_type, quality) =>
        Number(quality) > 0.54
          ? `data:image/jpeg;base64,${"a".repeat(60_000)}`
          : `data:image/jpeg;base64,${"a".repeat(20_000)}`,
      );

    const result = await compressCommentImage(new Blob(["image"], { type: "image/png" }), 48_000);

    expect(result.length).toBeLessThanOrEqual(48_000);
    expect(toDataUrl).toHaveBeenCalledWith("image/jpeg", 0.54);
    expect(close).toHaveBeenCalledOnce();
  });
});
