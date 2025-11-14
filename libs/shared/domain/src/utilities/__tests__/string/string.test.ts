import { $string } from '../../string/string';

describe('string utilities', () => {
  describe('capitalize', () => {
    it('should capitalize the first letter of a string', () => {
      expect($string.capitalize('hello')).toBe('Hello');
      expect($string.capitalize('world')).toBe('World');
      expect($string.capitalize('typescript')).toBe('Typescript');
    });

    it('should handle empty strings', () => {
      expect($string.capitalize('')).toBe('');
    });

    it('should handle single-character strings', () => {
      expect($string.capitalize('a')).toBe('A');
      expect($string.capitalize('z')).toBe('Z');
    });

    it('should not change already capitalized strings', () => {
      expect($string.capitalize('Hello')).toBe('Hello');
      expect($string.capitalize('WORLD')).toBe('WORLD');
    });

    it('should handle strings with leading whitespace', () => {
      expect($string.capitalize(' hello')).toBe(' hello');
      expect($string.capitalize('  test')).toBe('  test');
    });

    it('should handle strings with non-alphabetic first characters', () => {
      expect($string.capitalize('123abc')).toBe('123abc');
      expect($string.capitalize('!test')).toBe('!test');
      expect($string.capitalize('@name')).toBe('@name');
    });
  });

  describe('hashtags', () => {
    it('should count hashtags in text', () => {
      expect($string.hashtags('#hello #world').count).toBe(2);
      expect($string.hashtags('Check out #javascript and #typescript').count).toBe(2);
      expect($string.hashtags('#test').count).toBe(1);
    });

    it('should return 0 for text without hashtags', () => {
      expect($string.hashtags('hello world').count).toBe(0);
      expect($string.hashtags('').count).toBe(0);
      expect($string.hashtags('no hashtags here').count).toBe(0);
    });

    it('should handle hashtags with numbers', () => {
      expect($string.hashtags('#test123 #web3').count).toBe(2);
      expect($string.hashtags('#2024goals').count).toBe(1);
    });

    it('should handle hashtags with underscores and hyphens', () => {
      expect($string.hashtags('#test_case #web-dev').count).toBe(2);
      expect($string.hashtags('#my_hashtag #another-tag').count).toBe(2);
    });

    it('should handle hashtags with unicode characters', () => {
      expect($string.hashtags('#café #niño #español').count).toBe(3);
      expect($string.hashtags('#日本語 #中文').count).toBe(2);
    });

    it('should not count incomplete hashtags', () => {
      expect($string.hashtags('# incomplete').count).toBe(0);
      expect($string.hashtags('#').count).toBe(0);
    });

    it('should handle hashtags at different positions', () => {
      expect($string.hashtags('#start middle #end').count).toBe(2);
      expect($string.hashtags('text #middle more text').count).toBe(1);
    });

    it('should handle multiple hashtags in complex text', () => {
      const text = 'Love #coding with #javascript! #webdev #frontend #react #angular';
      expect($string.hashtags(text).count).toBe(6);
    });

    it('should handle hashtags with mixed case', () => {
      expect($string.hashtags('#JavaScript #HTML #CSS').count).toBe(3);
      expect($string.hashtags('#MixedCase #lowercase #UPPERCASE').count).toBe(3);
    });
  });

  describe('match', () => {
    it('should return matches for a regex pattern', () => {
      const text = 'Hello world 123 test';
      const numberRegex = /\d+/g;
      const result = $string.match(text)(numberRegex);
      
      expect(result).toEqual(['123']);
    });

    it('should return empty array when no matches found', () => {
      const text = 'Hello world';
      const numberRegex = /\d+/g;
      const result = $string.match(text)(numberRegex);
      
      expect(result).toEqual([]);
    });

    it('should handle multiple matches', () => {
      const text = 'Phone: 123-456-7890 or 098-765-4321';
      const numberRegex = /\d{3}-\d{3}-\d{4}/g;
      const result = $string.match(text)(numberRegex);
      
      expect(result).toEqual(['123-456-7890', '098-765-4321']);
    });

    it('should work with word boundaries', () => {
      const text = 'The cat and the dog';
      const wordRegex = /\bthe\b/gi;
      const result = $string.match(text)(wordRegex);
      
      expect(result).toEqual(['The', 'the']);
    });

    it('should handle empty text', () => {
      const text = '';
      const anyRegex = /.+/g;
      const result = $string.match(text)(anyRegex);
      
      expect(result).toEqual([]);
    });

    it('should work with email pattern', () => {
      const text = 'Contact: user@example.com or admin@test.org';
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      const result = $string.match(text)(emailRegex);
      
      expect(result).toEqual(['user@example.com', 'admin@test.org']);
    });
  });

  describe('urls', () => {
    it('should extract URLs from text', () => {
      const text = 'Visit https://example.com and http://test.org';
      const result = $string.urls(text);
      
      expect(result).toEqual(['https://example.com', 'http://test.org']);
    });

    it('should filter out LinkedIn company URLs', () => {
      const text = 'Check https://www.linkedin.com/company/example and https://example.com';
      const result = $string.urls(text);
      
      expect(result).toEqual(['https://example.com']);
    });

    it('should filter out email addresses', () => {
      const text = 'Contact user@example.com or visit https://example.com';
      const result = $string.urls(text);
      
      expect(result).toEqual(['https://example.com']);
    });

    it('should handle URLs with www prefix', () => {
      const text = 'Visit www.example.com and www.test.org';
      const result = $string.urls(text);
      
      expect(result).toEqual(['www.example.com', 'www.test.org']);
    });

    it('should trim whitespace from URLs', () => {
      const text = 'Visit  https://example.com  and  www.test.com  ';
      const result = $string.urls(text);
      
      expect(result).toEqual(['https://example.com', 'www.test.com']);
    });

    it('should return empty array when no URLs found', () => {
      const text = 'No URLs here, just plain text';
      const result = $string.urls(text);
      
      expect(result).toEqual([]);
    });

    it('should handle URLs with paths and parameters', () => {
      const text = 'API: https://api.example.com/v1/users?page=1';
      const result = $string.urls(text);
      
      expect(result).toEqual(['https://api.example.com/v1/users?page=1']);
    });

    it('should handle mixed content', () => {
      const text = 'Email: user@example.com, LinkedIn: https://www.linkedin.com/company/test, Site: https://example.com';
      const result = $string.urls(text);
      
      expect(result).toEqual(['https://example.com']);
    });

    it('should handle multiple URL types', () => {
      const text = 'Sites: https://secure.com, http://normal.com, www.prefix.com, ftp://files.com';
      const result = $string.urls(text);
      
      expect(result).toEqual(['https://secure.com', 'http://normal.com', 'www.prefix.com', 'ftp://files.com']);
    });
  });
});
