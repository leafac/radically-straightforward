import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import server from "@radically-straightforward/server";

test(async () => {
  const application = server(18000);

  let counter = 0;

  application.push({
    method: "PATCH",
    pathname: /^\/conversations\/(?<conversationId>[0-9]+)$/,
    handler: async (request: any, response: any) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      for (const value of Object.values<any>(request.body))
        if (typeof value.path === "string") {
          value.content = [...(await fs.readFile(value.path))];
          delete value.path;
        }
      response.end(
        JSON.stringify({
          pathname: request.pathname,
          search: request.search,
          headers: { "a-custom-header": request.headers["a-custom-header"] },
          cookies: request.cookies,
          body: request.body,
        }),
      );
      response.afters.push(() => {
        counter++;
      });
    },
  });

  {
    const response = await fetch(
      "http://localhost:18000/conversations/10?name=leandro",
      {
        method: "PATCH",
        headers: {
          "A-Custom-Header": "Hello",
          Cookie: "session=abc; colorScheme=dark",
        },
        body: new URLSearchParams({ age: "33" }),
      },
    );
    assert.equal(
      response.headers.get("Content-Type"),
      "application/json; charset=utf-8",
    );
    assert.deepEqual(await response.json(), {
      pathname: { conversationId: "10" },
      search: { name: "leandro" },
      headers: { "a-custom-header": "Hello" },
      cookies: { session: "abc", colorScheme: "dark" },
      body: { age: "33" },
    });
    assert.equal(counter, 1);
  }

  {
    const requestBody = new FormData();
    requestBody.append("age", "33");
    requestBody.append("avatar", new Blob([Buffer.from([33, 34, 3])]));
    assert.deepEqual(
      (
        await (
          await fetch("http://localhost:18000/conversations/10", {
            method: "PATCH",
            body: requestBody,
          })
        ).json()
      ).body,
      {
        age: "33",
        avatar: {
          encoding: "7bit",
          mimeType: "application/octet-stream",
          filename: "blob",
          content: [33, 34, 3],
        },
      },
    );
  }

  process.kill(process.pid);
});
