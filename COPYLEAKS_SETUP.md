# Copyleaks Setup Guide

## The Issue
Copyleaks blocks webhooks to internal IP addresses (localhost, 127.0.0.1, etc.) for security reasons. This means you need a public URL for webhooks to work in local development.

## Solution: Use ngrok for Local Development

### 1. Install ngrok
Download and install ngrok from https://ngrok.com/

### 2. Create a tunnel to your local webhook
```bash
ngrok http 3000
```

This will give you a public URL like: `https://abc123.ngrok.io`

### 3. Set the environment variable
Add this to your `.env.local` file:
```
COPYLEAKS_WEBHOOK_URL=https://abc123.ngrok.io/api/copyleaks/webhook
```

Replace `abc123.ngrok.io` with your actual ngrok URL.

### 4. Restart your development server
```bash
npm run dev
```

## Alternative: Use webhook.site for testing

If you just want to test the webhook flow without setting up ngrok:

1. Go to https://webhook.site/
2. Copy the unique URL (e.g., `https://webhook.site/unique-id`)
3. Set in your `.env.local`:
```
COPYLEAKS_WEBHOOK_URL=https://webhook.site/unique-id
```

Note: This will only show you the webhook data but won't process it in your app.

## Production Setup

For production, set:
```
COPYLEAKS_WEBHOOK_URL=https://yourdomain.com/api/copyleaks/webhook
```

## Testing

After setting up the webhook URL, try running a Copyleaks scan. You should see:
1. The scan submission succeed (no more "Cannot be internal ip" error)
2. Webhook data received in your console logs
3. Results displayed in the UI after the scan completes
