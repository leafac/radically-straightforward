#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs/promises";
import * as fsStream from "node:fs";
import stream from "node:stream/promises";
import * as commander from "commander";
import { execa } from "execa";
import archiver from "archiver";
import sh from "dedent";

const packageJSON = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf-8"),
);

await commander.program
  .name(packageJSON.name)
  .description(packageJSON.description)
  .option("-i, --input <input>", "The application directory.", ".")
  .argument(
    "[command...]",
    "The command to start the application. The ‘$PACKAGE’ environment variable contains the path to the application directory.",
    ["$PACKAGE/node_modules/.bin/node", "$PACKAGE/build/index.mjs"],
  )
  .version(packageJSON.version)
  .allowExcessArguments(false)
  .showHelpAfterError()
  .action(async (command: string[], { input }: { input: string }) => {
    input = path.resolve(input);
    const name = JSON.parse(
      await fs.readFile(path.join(input, "package.json"), "utf-8"),
    )
      .name.replaceAll("@", "")
      .replaceAll("/", "--");

    await execa("npm", ["dedupe"], {
      cwd: input,
      env: { NODE_ENV: "production" },
      stdio: "inherit",
    });

    await fs.mkdir(path.join(input, "node_modules/.bin"), { recursive: true });
    await fs.cp(
      process.execPath,
      path.join(input, "node_modules/.bin", path.basename(process.execPath)),
    );

    const archive =
      process.platform === "win32"
        ? archiver("zip")
        : archiver("tar", { gzip: true });
    const archiveStream = fsStream.createWriteStream(
      path.join(
        input,
        `../${name}.${process.platform === "win32" ? "zip" : "tar.gz"}`,
      ),
    );
    archive.pipe(archiveStream);
    archive.directory(input, `${name}/${name}--source`);
    archive.append(
      sh`
        #!/usr/bin/env sh
    
        export PACKAGE="$(dirname "$0")/${name}--source"
        exec ${command.map((commandPart) => `"${commandPart}"`).join(" ")} "$@"
      `,
      {
        name: `${name}/${name}`,
        mode: 0o755,
      },
    );
    await archive.finalize();
    await stream.finished(archiveStream);
  })
  .parseAsync();
