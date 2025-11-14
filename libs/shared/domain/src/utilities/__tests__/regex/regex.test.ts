import { EMAIL_REGEX, URL_REGEX, URL_GLOBAL } from '../../regex';

describe('regex', () => {
  describe('EMAIL_REGEX', () => {
    it('should match valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'firstname.lastname@example.com',
        'email@subdomain.example.com',
        'firstname+lastname@example.com',
        'email@123.123.123.123',
        '1234567890@example.com',
        'email@example-one.com',
        '_______@example.com',
        'email@example.name',
        'email@example.museum',
        'email@example.co.jp',
        'firstname-lastname@example.com',
      ];

      validEmails.forEach((email) => {
        expect(EMAIL_REGEX.test(email)).toBe(true);
      });
    });

    it('should not match invalid email addresses', () => {
      const invalidEmails = [
        'plainaddress',
        '@missingusername.com',
        'username@.com',
        '.username@example.com',
        'username@example..com',
        'username@example.com.',
        'username@.example.com',
        'username@.example..com',
        'username@example..com',
        'username@.com.',
        'username@.com',
        'username@-example.com',
        'username@example-.com',
        'username@.example.com',
        'username@.example..com',
        'username@example..com',
        'username@.com.',
        'username@.com',
        'username@.example.com',
        'username@.example..com',
        'username@example..com',
        'username@.com.',
      ];

      invalidEmails.forEach((email) => {
        expect(EMAIL_REGEX.test(email)).toBe(false);
      });
    });

    it('should enforce email length limits', () => {
      const tooLongLocal = 'a'.repeat(65) + '@example.com';
      expect(EMAIL_REGEX.test(tooLongLocal)).toBe(false);

      const tooLongEmail = 'a'.repeat(64) + '@' + 'example.' + 'a'.repeat(181) + '.com';
      expect(EMAIL_REGEX.test(tooLongEmail)).toBe(false);
    });
  });

  describe('URL_REGEX', () => {
    it('should match valid URLs', () => {
      const validUrls = [
        'https://www.example.com',
        'http://example.com',
        'https://example.com',
        'www.example.com',
        'example.com',
        'https://subdomain.example.com',
        'https://example.com/path',
        'https://example.com/path/to/page',
        'https://example.com/path?query=value',
        'https://example.com/path#fragment',
        'https://example.com/path?query=value&another=param',
        'https://example.com:8080',
        'https://example.com:8080/path',
        'https://192.168.1.1',
        'https://example-site.com',
        'https://example_site.com',
        'https://example.co.uk',
        'https://example.museum',
        'https://example.travel',
        'https://user@example.com',
        'https://user:pass@example.com',
        'https://example.com/path/with-dashes',
        'https://example.com/path_with_underscores',
        'https://example.com/path~with~tildes',
        'https://example.com/path%20with%20encoded',
        'https://api.example.com/v1/users/123',
        'https://cdn.example.com/assets/image.jpg',
      ];

      validUrls.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(true);
      });
    });

    it('should not match invalid URLs', () => {
      const invalidUrls = [
        '',
        'not-a-url',
        'http://',
        'https://',
        'http://.',
        'http://..',
        'http://../',
        'http://?',
        'http://??/',
        'http://#',
        'http://##/',
        'http:// shouldfail.com',
        'http://-error-.invalid/',
        'http://localhost', // localhost without domain extension
        'http://localhost:3000', // localhost with port
        'ftp://example.com', // FTP protocol not supported
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'tel:+1234567890',
        'sms:+1234567890',
      ];

      invalidUrls.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(false);
      });
    });

    it('should handle URLs with HTTP/HTTPS protocols', () => {
      const protocolUrls = ['http://example.com', 'https://example.com'];

      protocolUrls.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(true);
      });
    });

    it('should handle URLs without protocols', () => {
      const noProtocolUrls = ['www.example.com', 'example.com', 'subdomain.example.com'];

      noProtocolUrls.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(true);
      });
    });

    it('should handle URLs with paths and query parameters', () => {
      const complexUrls = [
        'https://example.com/api/v1/users',
        'https://example.com/search?q=test&page=1',
        'https://example.com/article#section-1',
        'https://example.com/path/to/resource?param1=value1&param2=value2#anchor',
        'https://api.github.com/repos/owner/repo/issues?state=open&labels=bug',
      ];

      complexUrls.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(true);
      });
    });

    it('should handle international domain names', () => {
      const internationalUrls = [
        'https://example.co.uk',
        'https://example.com.au',
        'https://example.de',
        'https://example.fr',
        'https://example.jp',
        'https://example.museum',
        'https://example.travel',
        'https://example.info',
      ];

      internationalUrls.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(true);
      });
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        'https://a.co', // Very short domain
        'https://example.com/', // Trailing slash
        'https://example.com//', // Double slash in path
        'https://example.com/path/', // Path with trailing slash
      ];

      edgeCases.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(true);
      });
    });

    it('should accept some edge cases that might be unexpected', () => {
      // These are accepted by the current regex implementation
      const acceptedEdgeCases = [
        'http://a.b--c.de/', // Double hyphens in domain
        'http://-a.b.co', // Domain starting with hyphen
        'http://a.b-.co', // Domain ending with hyphen
        'mailto:test@example.com', // mailto protocol (has @ and domain pattern)
      ];

      acceptedEdgeCases.forEach((url) => {
        expect(URL_REGEX.test(url)).toBe(true);
      });
    });
  });

  describe('URL_GLOBAL', () => {
    it('should find URLs with protocols in text', () => {
      const text = 'Visit https://example.com and http://another.com';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(matches).toEqual(['https://example.com', 'http://another.com']);
    });

    it('should find URLs with www prefix', () => {
      const text = 'Check out www.example.com and www.test.org';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(matches).toEqual(['www.example.com', 'www.test.org']);
    });

    it('should find URLs with paths and parameters', () => {
      const text = 'API: https://api.example.com/v1/users?page=1&limit=10';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
      expect(matches).toEqual(['https://api.example.com/v1/users?page=1&limit=10']);
    });

    it('should handle URLs with special characters', () => {
      const text = 'Sites: https://sub-domain.example.com and https://test_site.co.uk';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(matches).toEqual(['https://sub-domain.example.com', 'https://test_site.co.uk']);
    });

    it('should find URLs with ports', () => {
      const text = 'Dev server: https://localhost.example.com:8080';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
      expect(matches).toEqual(['https://localhost.example.com:8080']);
    });

    it('should handle mixed protocols', () => {
      const text = 'Links: http://example.com, https://secure.com, ftp://files.com';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(3);
      expect(matches).toEqual(['http://example.com', 'https://secure.com', 'ftp://files.com']);
    });

    it('should return null when no URLs found', () => {
      const texts = ['No URLs here', 'Just plain text', 'Phone: +1-234-567-8900', ''];

      texts.forEach((text) => {
        const matches = text.match(URL_GLOBAL);
        expect(matches).toBeNull();
      });
    });

    it('should match email addresses as URLs', () => {
      const text = 'Email: user@example.com';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
      expect(matches).toEqual(['user@example.com']);
    });

    it('should handle URLs in brackets and punctuation', () => {
      const text = 'Check (https://example.com) and [www.test.com]!';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
    });

    it('should find URLs at text boundaries', () => {
      const text = 'https://start.com is first, end with www.last.com';
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(matches).toEqual(['https://start.com', 'www.last.com']);
    });

    it('should handle multiline text', () => {
      const text = `First line: https://example.com
      Second line: www.another.com
      Third line: http://third.com`;
      const matches = text.match(URL_GLOBAL);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(3);
      expect(matches).toEqual(['https://example.com', 'www.another.com', 'http://third.com']);
    });
  });
});
