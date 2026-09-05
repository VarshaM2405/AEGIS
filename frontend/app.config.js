// app.config.js — dynamic wrapper around app.json.
//
// app.json holds all the static config. This file's only job is to inject
// per-deployment secrets from environment variables at build/start time, so
// nothing sensitive has to live in a file that gets committed to git.
//
// Setup: copy .env.example to .env.local and fill in your own Google Maps
// API key (see .env.example for where to get one). .env.local is already
// covered by .gitignore's `.env*.local` rule and is auto-loaded by the Expo
// CLI for local runs (`expo start`, `expo run:android`) and by EAS Build in
// the cloud — no extra setup needed beyond creating the file.
const appJson = require('./app.json');

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    console.warn(
      '\n[app.config.js] GOOGLE_MAPS_API_KEY is not set. The map screens will crash on a ' +
      'native build (Expo Go may mask this). Copy .env.example to .env.local and add your key.\n'
    );
  }

  return {
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo.android,
        config: {
          ...appJson.expo.android?.config,
          googleMaps: { apiKey: googleMapsApiKey },
        },
      },
      ios: {
        ...appJson.expo.ios,
        config: {
          ...appJson.expo.ios?.config,
          googleMapsApiKey,
        },
      },
    },
  };
};
