import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelDevicePoll,
  pollDeviceFlow,
  startDeviceFlow,
} from './auth'
import { GITHUB_OAUTH_CLIENT_ID } from '../../shared/githubAuth'

describe('device flow', () => {
  beforeEach(() => {
    cancelDevicePoll()
  })

  afterEach(() => {
    cancelDevicePoll()
    vi.unstubAllGlobals()
  })

  it('starts device flow and returns user_code', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        device_code: 'dc',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
    )

    const device = await startDeviceFlow(fetchImpl as unknown as typeof fetch)

    expect(device.user_code).toBe('ABCD-1234')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://github.com/login/device/code',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          client_id: GITHUB_OAUTH_CLIENT_ID,
          scope: 'repo',
        }),
      }),
    )
  })

  it('polls until access_token is returned', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: 'authorization_pending' }),
      )
      .mockResolvedValueOnce(
        Response.json({ access_token: 'gho_test_token' }),
      )

    const sleep = vi.fn(async () => undefined)

    const token = await pollDeviceFlow('dc', 1, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      maxAttempts: 5,
    })

    expect(token).toBe('gho_test_token')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalled()
  })

  it('throws when access is denied', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        error: 'access_denied',
        error_description: 'User cancelled',
      }),
    )

    await expect(
      pollDeviceFlow('dc', 1, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => undefined,
        maxAttempts: 3,
      }),
    ).rejects.toThrow(/denied/i)
  })

  it('increases interval on slow_down then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: 'slow_down' }))
      .mockResolvedValueOnce(
        Response.json({ access_token: 'gho_slow_ok' }),
      )

    const intervals: number[] = []
    const sleep = vi.fn(async (ms: number) => {
      intervals.push(ms)
    })

    const token = await pollDeviceFlow('dc', 1, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      maxAttempts: 5,
    })

    expect(token).toBe('gho_slow_ok')
    expect(intervals[0]).toBe(1000)
    expect(intervals[1]).toBe(6000)
  })
})
