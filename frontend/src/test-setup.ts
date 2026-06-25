import { expect, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import * as api from "./lib/api";

expect.extend(matchers);
afterEach(() => cleanup());

/**
 * vitest 跑在 jsdom 环境(jsdom 没有后端 server),
 * lib/api.ts 默认 useMock=false 会走真实 fetch → 相对路径 /api/... 解析失败。
 *
 * 这里用 ESM static import + 改 useMock.value = true,所有后续 test file
 * 的 import 看到的 useMock 是同一个对象(getter/setter 走 _useMock 模块级状态)。
 *
 * 必须用 static import 而不是 dynamic `await import()`:dynamic import 会把
 * 模块放到 microtask 队列,可能晚于 test file 的 import 执行,导致来不及改。
 */
beforeAll(() => {
  api.useMock.value = true;
});