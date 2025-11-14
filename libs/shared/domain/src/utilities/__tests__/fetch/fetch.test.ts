import { Fetch, $fetch } from '../../fetch/fetch';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('Fetch Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('test-token');
    mockFetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ success: true, data: 'test-data' }),
    });
  });

  describe('defaultHeaders', () => {
    it('should include Content-Type and Authorization headers', async () => {
      await Fetch.get('/test');

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('should handle missing token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await Fetch.get('/test');

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer null',
        },
      });
    });
  });

  describe('request method', () => {
    it('should make GET request with default options', async () => {
      const result = await Fetch.request('/test');

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
      expect(result).toEqual({ success: true, data: 'test-data' });
    });

    it('should make POST request with body', async () => {
      const body = { name: 'test', value: 123 };

      await Fetch.request('/test', { method: 'POST', body });

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      });
    });

    it('should handle string body', async () => {
      const body = 'raw-string-data';

      await Fetch.request('/test', { method: 'POST', body: body as any });

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: 'raw-string-data',
      });
    });

    it('should merge custom headers', async () => {
      const customHeaders = { 'X-Custom': 'custom-value', Authorization: 'Bearer custom-token' };

      await Fetch.request('/test', { headers: customHeaders });

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer custom-token',
          'X-Custom': 'custom-value',
        },
      });
    });

    it('should use baseUrl when provided', async () => {
      await Fetch.request('/endpoint', { baseUrl: 'https://api.example.com' });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/endpoint', expect.any(Object));
    });

    it('should not add body to GET requests', async () => {
      await Fetch.request('/test', { method: 'GET', body: { data: 'test' } });

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
    });
  });

  describe('HTTP method shortcuts', () => {
    it('should make GET request', async () => {
      await Fetch.get('/users');

      expect(mockFetch).toHaveBeenCalledWith('/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('should make POST request with body', async () => {
      const body = { name: 'John', email: 'john@example.com' };

      await Fetch.post('/users', body);

      expect(mockFetch).toHaveBeenCalledWith('/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      });
    });

    it('should make POST request without body', async () => {
      await Fetch.post('/users');

      expect(mockFetch).toHaveBeenCalledWith('/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('should make PUT request with body', async () => {
      const body = { id: 1, name: 'Updated Name' };

      await Fetch.put('/users/1', body);

      expect(mockFetch).toHaveBeenCalledWith('/users/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      });
    });

    it('should make DELETE request', async () => {
      await Fetch.delete('/users/1');

      expect(mockFetch).toHaveBeenCalledWith('/users/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('should make PATCH request with body', async () => {
      const body = { name: 'Patched Name' };

      await Fetch.patch('/users/1', body);

      expect(mockFetch).toHaveBeenCalledWith('/users/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      });
    });
  });

  describe('$fetch alias', () => {
    it('should be an alias for Fetch class', () => {
      expect($fetch).toBe(Fetch);
    });

    it('should work with all methods', async () => {
      await $fetch.get('/test');
      await $fetch.post('/test', { data: 'test' });
      await $fetch.put('/test', { data: 'test' });
      await $fetch.delete('/test');
      await $fetch.patch('/test', { data: 'test' });

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('options handling', () => {
    it('should handle baseUrl with GET', async () => {
      await Fetch.get('/endpoint', { baseUrl: 'https://api.example.com', headers: { 'X-Test': 'value' } });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/endpoint', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
          'X-Test': 'value',
        },
      });
    });

    it('should handle baseUrl with POST', async () => {
      const body = { test: 'data' };

      await Fetch.post('/endpoint', body, { baseUrl: 'https://api.example.com' });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      });
    });
  });

  describe('error handling', () => {
    it('should propagate fetch errors', async () => {
      const error = new Error('Network error');
      mockFetch.mockRejectedValue(error);

      await expect(Fetch.get('/test')).rejects.toThrow('Network error');
    });

    it('should propagate JSON parsing errors', async () => {
      const error = new Error('Invalid JSON');
      mockFetch.mockResolvedValue({
        json: jest.fn().mockRejectedValue(error),
      });

      await expect(Fetch.get('/test')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('TypeScript generics', () => {
    interface User {
      id: number;
      name: string;
      email: string;
    }

    it('should support typed responses', async () => {
      const userData = { id: 1, name: 'John', email: 'john@example.com' };
      mockFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue(userData),
      });

      const result = await Fetch.get<User>('/users/1');

      expect(result).toEqual(userData);
      expect(typeof result.id).toBe('number');
      expect(typeof result.name).toBe('string');
      expect(typeof result.email).toBe('string');
    });
  });
});
