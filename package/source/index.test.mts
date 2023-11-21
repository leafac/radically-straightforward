import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execa } from "execa";

test(async () => {
  await execa("node", ["../build/index.mjs"], {
    cwd: "./example-application",
  });
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "radically-straightforward--package--test--"),
  );
  await execa("tar", ["-xvzf", "example-application.tar.gz", "-C", directory]);
  await fs.rm("example-application.tar.gz");
  const result = await execa(
    path.join(directory, "example-application", "example-application"),
    ["examples", "of", "some", "extra", "command-line", "arguments"],
    { env: { EXAMPLE_PROGRAM: "true" }, all: true, reject: false },
  );
  const output = JSON.parse(result.all!);
  assert.deepEqual(output.argv.slice(2), [
    "examples",
    "of",
    "some",
    "extra",
    "command-line",
    "arguments",
  ]);
  assert(output.env.PACKAGE.endsWith("example-application--source"));
  assert.equal(output.env.EXAMPLE_PROGRAM, "true");
  assert.equal(
    output.image,
    "/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA/wAA",
  );
  assert.equal(result.exitCode, 1);
});
