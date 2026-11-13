import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const { response, code } = error;
  if (!response) {
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      return 'The server took too long to respond. Please try again.';
    }
    return "Can't connect to the server. Check your internet connection and try again.";
  }

  if (response.status >= 500) {
    return 'The server is temporarily unavailable. Please try again shortly.';
  }

  const data = response.data;
  if (data && typeof data === 'object') {
    const detail = (data as Record<string, unknown>).detail;
    if (typeof detail === 'string') return detail;

    for (const value of Object.values(data)) {
      const message = Array.isArray(value) ? value.find((item) => typeof item === 'string') : value;
      if (typeof message === 'string') return message;
    }
  }

  return fallback;
}
