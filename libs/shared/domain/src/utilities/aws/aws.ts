const urls = ['https://prod-files.socialgest.net/', 'https://dev-tempfiles.socialgest.net/'];

export const aws = {
  parse: (url: string) => {
    return url
      .replace(/%2Fimages%2F/, '/images/')
      .replace(/%252Fimages%252F/, '/images/')
      .replace(/s3\.amazonaws\.com\//, '');
  },

  convert: (url: string) => {
    return urls.some((item) => url.includes(item)) ? 'https://s3.amazonaws.com/' + url.split('https://')[1] : url;
  },

  is: {
    bucket: (url: string) => urls.some((item) => url.includes(item)),
    prod: (url: string) => url.includes(urls[0]),
    temporal: (url: string) => url.includes(urls[1]),
  },
};
