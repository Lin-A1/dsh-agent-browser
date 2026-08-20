import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as childProcess from 'node:child_process'
import { runBrowserCommand } from '../src/index.ts'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))

const config = { executablePath: 'agent-browser', timeoutMs: 1000, maxOutputChars: 20, sessionPrefix: 'test', screenshotDir: undefined }
const execFileMock = vi.mocked(childProcess.execFile)

describe('agent-browser CLI adapter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('constructs isolated JSON commands and parses JSON', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) => { (cb as Function)(null, '{"title":"ok"}', ''); return {} as never })
    const result = await runBrowserCommand('browser_open', { url: 'https://example.com', session: 'one' }, config)
    expect(result.ok).toBe(true); expect(result.command).toEqual(['--session', 'test-one', '--json', '--max-output', '20', 'open', 'https://example.com']); expect(result.data).toEqual({ title: 'ok' })
  })
  it('returns non-zero exit details', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) => { (cb as Function)(Object.assign(new Error('bad'), { code: 2 }), 'x', 'no'); return {} as never })
    const result = await runBrowserCommand('browser_click', { selector: '#x' }, config)
    expect(result.ok).toBe(false); expect(result.exitCode).toBe(2); expect(result.stderr).toBe('no')
  })
  it('reports timeout', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) => { (cb as Function)(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT', killed: true }), '', ''); return {} as never })
    expect((await runBrowserCommand('browser_snapshot', {}, config)).timedOut).toBe(true)
  })
  it('bounds output and preserves plain text', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) => { (cb as Function)(null, 'abcdefghijklmnopqrstuvwxyz', ''); return {} as never })
    const result = await runBrowserCommand('browser_read', {}, config)
    expect(result.stdout).toBe('abcdefghijklmnopqrst'); expect(result.data).toBe('abcdefghijklmnopqrst')
  })
})
