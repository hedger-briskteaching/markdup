/**
 * Content script entry point for the Markdup browser extension.
 * Starts the markdown review UI on GitHub PR pages.
 */
import { initMarkdownReview } from "./markdownReview/init";

initMarkdownReview();
