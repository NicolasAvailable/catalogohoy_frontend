import { EMAIL_REGEX, URL_GLOBAL, LINKEDIN_COMPANY_REGEX } from '../regex';

export const $string = {
  capitalize: (text: string) => text.charAt(0).toUpperCase() + text.slice(1),
  match: (text: string) => (regex: RegExp) => text.match(regex) || [],
  hashtags: (text: string) => ({ count: text.match(/#[\p{L}\d_-]+/gu)?.length || 0 }),
  urls: (text: string) =>
    $string
      .match(text)(URL_GLOBAL)
      .map((url) => url.trim())
      .filter((url) => !LINKEDIN_COMPANY_REGEX.test(url) && !EMAIL_REGEX.test(url)),
};
