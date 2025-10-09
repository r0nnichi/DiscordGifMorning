# Discord Good Morning Bot

A Discord bot that replies to "Good morning" messages with random GIFs from Tenor.

## Features

- Responds to messages containing "Good morning" (case-insensitive)
- Fetches random GIFs from Tenor API
- Express server to keep the bot alive
- Fallback to emoji response if GIF fetch fails

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your tokens:
```
DISCORD_TOKEN=your_discord_bot_token_here
TENOR_API_KEY=your_tenor_api_key_here
```

3. Get your Discord Bot Token:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section and create a bot
   - Copy the token

4. Get your Tenor API Key:
   - Go to [Tenor API](https://developers.google.com/tenor/guides/quickstart)
   - Register for an API key

5. Run the bot:
```bash
node index.js
```

## How It Works

The bot listens for messages containing "good morning" and responds with:
- A random GIF from Tenor (if API is available)
- A friendly emoji message (if GIF fetch fails)

The Express server runs on port 3000 to keep the bot alive and provides a health check endpoint.
