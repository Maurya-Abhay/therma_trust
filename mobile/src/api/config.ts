import Constants from 'expo-constants';

const configuredUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ?? process.env.THERMATRUST_API_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;
const configuredWebUrl =
  Constants.expoConfig?.extra?.publicWebBaseUrl ?? process.env.EXPO_PUBLIC_WEB_BASE_URL ?? process.env.FRONTEND_URL;
const isDevelopment = __DEV__;

/** One backend URL shared by all mobile API calls and generated file links. */
if (!configuredUrl && !isDevelopment) {
  throw new Error('The production API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL to the deployed HTTPS API.');
}

export const API_BASE_URL = String(configuredUrl || 'http://localhost:8000/api').replace(/\/+$/, '');
export const PUBLIC_WEB_BASE_URL = String(configuredWebUrl || 'https://therma-trust-amber.vercel.app').replace(/\/+$/, '');

if (!isDevelopment) {
  const apiUrl = new URL(API_BASE_URL);
  const webUrl = new URL(PUBLIC_WEB_BASE_URL);
  if (apiUrl.protocol !== 'https:' || apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1') {
    throw new Error('Production API URL must use HTTPS and a reachable non-localhost host.');
  }
  if (webUrl.protocol !== 'https:' || webUrl.hostname === 'localhost' || webUrl.hostname === '127.0.0.1') {
    throw new Error('Production web URL must use HTTPS and a reachable non-localhost host.');
  }
}
