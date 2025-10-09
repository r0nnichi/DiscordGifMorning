# Discord Good Morning Bot

## Overview

A Discord bot that automatically responds to "Good morning" messages with random GIFs from Tenor's API. The bot provides a simple, friendly interaction by detecting morning greetings and replying with animated content. An Express server keeps the bot alive and provides health check functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Bot Architecture
- **Discord.js Client**: Uses Discord.js v14 with Gateway Intents for guild messages and message content access
- **Event-Driven Design**: Listens for message events and responds to pattern matches (case-insensitive "good morning")
- **Async Message Processing**: Handles API calls and responses asynchronously to avoid blocking

### API Integration Strategy
- **Tenor GIF API**: Fetches random GIFs using search-based queries with randomization
- **Graceful Degradation**: Falls back to emoji responses when GIF fetch fails
- **Error Handling**: Catches and logs API failures without crashing the bot

### Keep-Alive Server
- **Express HTTP Server**: Runs alongside the Discord bot on port 3000
- **Health Check Endpoint**: Provides a root endpoint (`/`) to verify bot status
- **Uptime Strategy**: Designed to work with services that ping endpoints to keep applications alive

### Configuration Management
- **Environment Variables**: Uses dotenv for secure credential management
- **Required Secrets**: 
  - `DISCORD_TOKEN`: Bot authentication token
  - `TENOR_API_KEY`: Tenor API access key
- **Port Configuration**: Supports `PORT` environment variable with fallback to 3000

## External Dependencies

### Third-Party Services
- **Discord API**: Core platform for bot operations (via discord.js library)
- **Tenor API**: GIF content provider (v2 API endpoint: `https://tenor.googleapis.com/v2/search`)

### NPM Packages
- **discord.js** (^14.23.2): Discord bot framework with gateway intents
- **axios** (^1.12.2): HTTP client for Tenor API requests
- **dotenv** (^17.2.3): Environment variable loader
- **express** (^5.1.0): Web server framework for keep-alive functionality

### API Requirements
- Discord Bot Token from Discord Developer Portal
- Tenor API Key from Google Tenor Developer Platform
- Both services require account registration and application setup