import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";

//#region src/index.d.ts
declare const name = "dsh-agent-browser";
declare const inject: string[];
interface Config {
  executablePath?: string;
  timeoutMs?: number;
  maxOutputChars?: number;
  sessionPrefix?: string;
  screenshotDir?: string;
}
declare const Config: z<Config>;
interface BrowserArgs {
  url?: string;
  selector?: string;
  text?: string;
  key?: string;
  path?: string;
  full?: boolean;
  session?: string;
  expression?: string;
  target?: string;
  condition?: 'selector' | 'timeout';
  value?: string;
}
type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
interface BrowserResult {
  ok: boolean;
  command: string[];
  session?: string;
  data?: JsonValue;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  error?: string;
}
type ResolvedConfig = Omit<Required<Config>, 'screenshotDir'> & Pick<Config, 'screenshotDir'>;
declare function runBrowserCommand(tool: string, args: BrowserArgs, config: ResolvedConfig): Promise<BrowserResult>;
/** Register model-facing browser automation tools. */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, apply, inject, name, runBrowserCommand };