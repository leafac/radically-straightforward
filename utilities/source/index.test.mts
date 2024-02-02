import test from "node:test";
import assert from "node:assert/strict";
import * as node from "@radically-straightforward/node";
import * as utilities from "./index.mjs";
import { intern as $ } from "./index.mjs";

test(
  "backgroundJob()",
  {
    ...(!process.stdin.isTTY
      ? {
          skip: "Run interactive test with ‘node ./build/index.test.mjs’.",
        }
      : {}),
  },
  async () => {
    const backgroundJob = utilities.backgroundJob(
      { interval: 3 * 1000 },
      async () => {
        console.log("backgroundJob(): Running background job...");
        await utilities.sleep(3 * 1000);
        console.log("backgroundJob(): ...finished running background job.");
      },
    );
    console.log(
      "backgroundJob(): Press ⌃Z to force background job to run and ⌃C to continue...",
    );
    process.on("SIGTSTP", () => {
      backgroundJob.run();
    });
    await node.shouldTerminate();
    backgroundJob.stop();
  },
);

test("sleep()", async () => {
  const before = Date.now();
  await utilities.sleep(1000);
  assert(Date.now() - before >= 1000);
});

test("randomString()", () => {
  const randomString = utilities.randomString();
  assert(10 <= randomString.length && randomString.length <= 11);
  assert.match(randomString, /^[0-9a-z]+$/);
});

test("randomString()", () => {
  utilities.log("EXAMPLE", "OF", "TAB-SEPARATED LOGGING");
});

test("intern()", async () => {
  const getPoolSize = () => {
    const openList = [$._pool.tuples, $._pool.records];
    let size = 0;
    while (openList.length) {
      const node = openList.pop();
      size++;
      for (const innerValueMap of node?.children?.values() || []) {
        for (const x of innerValueMap?.values()) {
          openList.push(x);
        }
      }
    }
    return size;
  };

  // 2 root nodes for records and tuples
  const initialPoolSize = 2;

  assert.equal(getPoolSize(), initialPoolSize);

  {
    $([1]);
  }

  assert.equal(getPoolSize(), initialPoolSize + 1);

  // Manually: Call "Collect Garbage" in the memory tab to see the finalization registry being called
  // await new Promise((r) => void setTimeout(r, 5000));
  // console.log('Pool size now', getPoolSize())

  const node = $._pool.tuples.children?.get(0)?.get(1);
  assert(!!node?.internedObject?.deref());
  node!.internedObject = { deref: () => undefined } as any;
  $._finalizationRegistryCallback(node!);
  assert.equal(getPoolSize(), initialPoolSize);

  // @ts-expect-error
  assert(([1] === [1]) === false);
  assert($([1]) === $([1]));
  assert($({ a: 1, b: 2 }) === $({ b: 2, a: 1 }));

  assert($([1]) !== $([2]));

  {
    const map = new Map<number[], number>();
    map.set([1], 1);
    map.set([1], 2);
    assert.equal(map.size, 2);
    assert.equal(map.get([1]), undefined);
  }

  {
    const map = new Map<utilities.Interned<number[]>, number>();
    map.set($([1]), 1);
    map.set($([1]), 2);
    assert.equal(map.size, 1);
    assert.equal(map.get($([1])), 2);
  }

  {
    const set = new Set<number[]>();
    set.add([1]);
    set.add([1]);
    assert.equal(set.size, 2);
    assert(set.has([1]) === false);
  }

  {
    const set = new Set<utilities.Interned<number[]>>();
    set.add($([1]));
    set.add($([1]));
    assert.equal(set.size, 1);
    assert(set.has($([1])));
  }

  {
    assert.throws(() => {
      // @ts-expect-error
      $([1, {}]);
    });
    assert($([1, $({})]) === $([1, $({})]));
  }

  assert.throws(() => {
    // @ts-expect-error
    $([1])[0] = 2;
  });

  {
    const iterations = 1000;
    console.time("intern()");
    const objects = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
      const entries = [];
      for (let key = 0; key < Math.floor(Math.random() * 15); key++) {
        entries.push([String(key + Math.floor(Math.random() * 15)), true]);
      }
      objects.push($(Object.fromEntries(entries)));
      objects.push($(entries.flat()));
    }
    // console.log($.pool.record.size);
    console.timeEnd("intern()");
  }
});
