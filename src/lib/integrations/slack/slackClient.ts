/**
 * Lightweight Slack API Client for OnTask.
 * Handles OAuth token exchange, posting messages, listing channels, and auth validation.
 */

export interface SlackOAuthResponse {
  ok: boolean
  access_token?: string
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: {
    id: string
    name: string
  }
  authed_user?: {
    id: string
  }
  error?: string
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  is_member: boolean
}

export interface SlackChannelsResponse {
  ok: boolean
  channels?: SlackChannel[]
  error?: string
}

export interface SlackPostMessageResponse {
  ok: boolean
  ts?: string
  channel?: string
  error?: string
}

/**
 * Exchanges OAuth authorization code for bot credentials.
 */
export async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
): Promise<SlackOAuthResponse> {
  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Slack Client ID or Secret is not configured in environment variables.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`Slack OAuth endpoint returned status ${response.status}`)
  }

  return response.json()
}

/**
 * Posts a formatted message block to a specified Slack channel.
 */
export async function postSlackMessage(
  token: string,
  channelId: string,
  fallbackText: string,
  blocks?: unknown[],
): Promise<SlackPostMessageResponse> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text: fallbackText,
      blocks,
    }),
  })

  if (!response.ok) {
    throw new Error(`Slack chat.postMessage HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Fetches available channels from the connected Slack workspace.
 */
export async function listSlackChannels(
  token: string,
): Promise<SlackChannel[]> {
  const params = new URLSearchParams({
    types: 'public_channel,private_channel',
    exclude_archived: 'true',
    limit: '200',
  })

  const response = await fetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Slack conversations.list HTTP ${response.status}`)
  }

  const data: SlackChannelsResponse = await response.json()
  if (!data.ok || !data.channels) {
    throw new Error(data.error || 'Failed to fetch Slack channels.')
  }

  return data.channels
}

/**
 * Validates the bot access token with Slack.
 */
export async function testSlackAuth(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()
    return Boolean(data.ok)
  } catch {
    return false
  }
}
