import { boolean } from '@shared/domain';

export class AuthenticationTokenService {
  public readonly AUTH_CONFIG_KEY = 'sb-yvkurjivijnhliofmfmj-auth-token';

  public get authConfigValue() {
    return localStorage.getItem(this.AUTH_CONFIG_KEY);
  }

  public isValid() {
    return boolean(this.authConfigValue);
  }

  public clear(): void {
    localStorage.removeItem(this.AUTH_CONFIG_KEY);
  }
}

export const authenticationTokenService = new AuthenticationTokenService();
