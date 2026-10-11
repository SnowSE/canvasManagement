import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll } from "vitest";

// Each test file gets its own storage root, so files running in parallel
// can't list or delete each other's courses.
const storageDirectory = mkdtempSync(join(tmpdir(), "canvasManagerTests-"));
process.env.STORAGE_DIRECTORY = storageDirectory;
afterAll(() => rmSync(storageDirectory, { recursive: true, force: true }));
