# YouTube Upload Setup

This document explains how to set up YouTube OAuth credentials for uploading videos to YouTube.

## Prerequisites

1. A Google account
2. Access to Google Cloud Console

## Steps to Set Up YouTube API

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 2. Enable YouTube Data API v3

1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for "YouTube Data API v3"
3. Click on it and click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (if you don't have a Google Workspace)
3. Fill in the required fields:
   - **App name**: "Chess Moments" (or your app name)
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**
5. On the **Scopes** screen, click **Add or Remove Scopes**
6. Filter for "YouTube" and add: `https://www.googleapis.com/auth/youtube.upload`
7. Click **Update** then **Save and Continue**
8. On the **Test users** screen, click **Add Users**
9. **IMPORTANT**: Add your Google account email (vidar.masson@gmail.com) as a test user
10. Click **Add** then **Save and Continue**
11. Review and go back to dashboard

### 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: "Chess Moments YouTube Uploader"
5. Authorized redirect URIs: Add `http://localhost:3000/api/youtube/callback` (or your production URL)
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### 5. Get Refresh Token

You need to authenticate once to get a refresh token. Use this Node.js script:

```javascript
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:3000/api/youtube/callback'
);

const scopes = ['https://www.googleapis.com/auth/youtube.upload'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', (code) => {
  rl.close();
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('Error retrieving access token', err);
      return;
    }
    console.log('Your refresh token is:', token.refresh_token);
  });
});
```

Run this script:
```bash
node get-refresh-token.js
```

1. Visit the URL printed in the console
2. Sign in with your Google account
3. Grant the requested permissions
4. Copy the authorization code from the URL
5. Paste it into the terminal
6. Save the refresh token that's printed

### 6. Add Environment Variables

Add these to your `.env` file:

```env
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
YOUTUBE_REFRESH_TOKEN=your_refresh_token_here
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback
```

## Usage

Once configured, users can:

1. Render a video from a chess game
2. Click "Upload to YouTube" button on any rendered video
3. The video will be uploaded to YouTube as an unlisted video
4. A link to the YouTube video will be displayed

## Privacy Settings

By default, videos are uploaded as **unlisted**. You can change this in the upload API route:

- `public`: Anyone can search for and view the video
- `unlisted`: Only people with the link can view the video
- `private`: Only you and users you choose can view the video

Edit `/src/app/api/youtube/upload/route.ts` and change the `privacyStatus` value.

## Troubleshooting

### "YouTube API credentials not configured" error

Make sure all three environment variables are set in your `.env` file and restart your dev server.

### "Token has been expired or revoked" error

Your refresh token may have expired. Generate a new one using the script above.

### Upload fails with quota error

YouTube API has daily quotas. Free tier allows 10,000 units per day. Uploading a video costs approximately 1,600 units.

### Video processing takes time

After upload, YouTube needs time to process the video. It will be available at the returned URL, but may take a few minutes to be playable.

## Security Notes

- **Never commit** your `.env` file to version control
- Keep your Client Secret secure
- Refresh tokens should be treated as passwords
- Consider implementing user-specific OAuth flow for production use
