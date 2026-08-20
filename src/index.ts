import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import * as childProcess from 'node:child_process'
import type { ExecFileException } from 'node:child_process'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ParameterSchemaSpec, ValueSchemaSpec } from '@deepseek-ai/dsh-tools'

const DEFAULT_TIMEOUT = 60_000
const DEFAULT_OUTPUT = 32_000

export const name = 'dsh-agent-browser'
export const inject = ['tools']

export interface Config {
  executablePath?: string
  timeoutMs?: number
  maxOutputChars?: number
  sessionPrefix?: string
  screenshotDir?: string
}

export const Config: z<Config> = z.object({
  executablePath: z.string().default('agent-browser'),
  timeoutMs: z.number().default(DEFAULT_TIMEOUT),
  maxOutputChars: z.number().default(DEFAULT_OUTPUT),
  sessionPrefix: z.string().default('dsh'),
  screenshotDir: z.string(),
})

interface BrowserArgs { url?: string; selector?: string; text?: string; key?: string; path?: string; full?: boolean; session?: string; expression?: string; target?: string; condition?: 'selector' | 'timeout'; value?: string }
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
interface BrowserResult { ok: boolean; command: string[]; session?: string; data?: JsonValue; stdout?: string; stderr?: string; exitCode?: number | null; timedOut?: boolean; error?: string }
type ResolvedConfig = Omit<Required<Config>, 'screenshotDir'> & Pick<Config, 'screenshotDir'>

const OUTPUT_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  ok: { type: 'boolean', required: true }, command: { type: 'array', items: { type: 'string' }, required: true },
  session: { type: 'string' }, data: { type: 'json' }, stdout: { type: 'string' }, stderr: { type: 'string' }, exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }] }, timedOut: { type: 'boolean' }, error: { type: 'string' },
} } as const satisfies ValueSchemaSpec

function sessionName(config: ResolvedConfig, session: string | undefined): string {
  const clean = session?.trim()
  if (session !== undefined && !clean) throw new Error('session must be non-empty when provided')
  return clean ? `${config.sessionPrefix}-${clean}` : config.sessionPrefix
}

function commandFor(tool: string, args: BrowserArgs, config: ResolvedConfig): string[] {
  const global = ['--session', sessionName(config, args.session), '--json', '--max-output', String(config.maxOutputChars), ...(config.screenshotDir ? ['--screenshot-dir', config.screenshotDir] : [])]
  switch (tool) {
    case 'browser_open': return [...global, 'open', ...(args.url ? [args.url] : [])]
    case 'browser_snapshot': return [...global, 'snapshot']
    case 'browser_read': return [...global, 'read', ...(args.url ? [args.url] : [])]
    case 'browser_click': return [...global, 'click', args.selector!]
    case 'browser_fill': return [...global, 'fill', args.selector!, args.text!]
    case 'browser_type': return [...global, 'type', args.selector!, args.text!]
    case 'browser_press': return [...global, 'press', args.key!]
    case 'browser_screenshot': return [...global, 'screenshot', ...(args.path ? [args.path] : []), ...(args.full ? ['--full'] : [])]
    case 'browser_eval': return [...global, 'eval', args.expression!]
    case 'browser_get': return [...global, 'get', args.target!, ...(args.selector ? [args.selector] : [])]
    case 'browser_wait': return [...global, 'wait', args.value!]
    case 'browser_close': return [...global, 'close']
    default: throw new Error(`Unknown browser tool: ${tool}`)
  }
}

export async function runBrowserCommand(tool: string, args: BrowserArgs, config: ResolvedConfig): Promise<BrowserResult> {
  const command = commandFor(tool, args, config)
  try {
    const result = await new Promise<{ stdout: string | Buffer; stderr: string | Buffer }>((resolve, reject) => {
      childProcess.execFile(config.executablePath, command, { timeout: config.timeoutMs, maxBuffer: config.maxOutputChars * 2, windowsHide: true }, (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stdout, stderr }))
        else resolve({ stdout, stderr })
      })
    })
    const stdout = result.stdout.toString().slice(0, config.maxOutputChars)
    let data: JsonValue
    try { data = JSON.parse(stdout) } catch { data = stdout }
    return { ok: true, command, session: sessionName(config, args.session), data, stdout, stderr: result.stderr.toString().slice(0, config.maxOutputChars), exitCode: 0, timedOut: false }
  } catch (error) {
    const failure = error as ExecFileException & { stdout?: string; stderr?: string; killed?: boolean }
    const stdout = failure.stdout?.slice(0, config.maxOutputChars) ?? ''
    const stderr = failure.stderr?.slice(0, config.maxOutputChars) ?? ''
    return { ok: false, command, session: sessionName(config, args.session), stdout, stderr, exitCode: failure.code && typeof failure.code === 'number' ? failure.code : null, timedOut: failure.killed === true || failure.code === 'ETIMEDOUT', error: failure.message }
  }
}

type ToolSpec = { name: string; description: string; parameters: ParameterSchemaSpec }
const specs: ToolSpec[] = [
  { name: 'browser_open', description: 'Launch the browser, optionally navigating to a URL.', parameters: { url: { type: 'string' }, session: { type: 'string' } } },
  { name: 'browser_snapshot', description: 'Return the accessibility tree of the active page.', parameters: { session: { type: 'string' } } },
  { name: 'browser_read', description: 'Read agent-friendly page text, or the active rendered page.', parameters: { url: { type: 'string' }, session: { type: 'string' } } },
  { name: 'browser_click', description: 'Click an element by selector or accessibility ref.', parameters: { selector: { type: 'string', required: true }, session: { type: 'string' } } },
  { name: 'browser_fill', description: 'Clear and fill an input.', parameters: { selector: { type: 'string', required: true }, text: { type: 'string', required: true }, session: { type: 'string' } } },
  { name: 'browser_type', description: 'Type text into an input.', parameters: { selector: { type: 'string', required: true }, text: { type: 'string', required: true }, session: { type: 'string' } } },
  { name: 'browser_press', description: 'Press a keyboard key.', parameters: { key: { type: 'string', required: true }, session: { type: 'string' } } },
  { name: 'browser_screenshot', description: 'Save a screenshot of the active page.', parameters: { path: { type: 'string' }, full: { type: 'boolean' }, session: { type: 'string' } } },
  { name: 'browser_eval', description: 'Evaluate JavaScript in the active page. Treat expression as untrusted page code.', parameters: { expression: { type: 'string', required: true }, session: { type: 'string' } } },
  { name: 'browser_get', description: 'Get URL, title, text, or HTML from the page.', parameters: { target: { type: 'string', required: true, enum: ['url', 'title', 'text', 'html'] }, selector: { type: 'string' }, session: { type: 'string' } } },
  { name: 'browser_wait', description: 'Wait for a selector or a number of milliseconds.', parameters: { condition: { type: 'string', required: true, enum: ['selector', 'timeout'] }, value: { type: 'string', required: true }, session: { type: 'string' } } },
  { name: 'browser_close', description: 'Close the browser session.', parameters: { session: { type: 'string' } } },
]

/** Register model-facing browser automation tools. */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (!Number.isInteger(resolved.timeoutMs) || resolved.timeoutMs < 1) throw new Error('timeoutMs must be a positive integer')
  if (!Number.isInteger(resolved.maxOutputChars) || resolved.maxOutputChars < 1) throw new Error('maxOutputChars must be a positive integer')
  if (resolved.sessionPrefix.trim().length === 0) throw new Error('sessionPrefix must be non-empty')
  for (const spec of specs) {
    ctx.tools.register(defineTool({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      output: { schema: OUTPUT_SCHEMA, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute: (args) => runBrowserCommand(spec.name, args as unknown as BrowserArgs, resolved),
    }))
  }
}
