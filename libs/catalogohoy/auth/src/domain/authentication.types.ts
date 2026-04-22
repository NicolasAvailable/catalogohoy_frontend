export type LoginCredentials = {
  email: string;
  password: string;
};

export type SignUpCredentials = {
  name: string;
  email: string;
  storeName: string;
  password: string;
  /** ISO2 country code chosen by the user at signup (e.g. "VE", "BR"). */
  countryCode?: string;
};

export type GoogleSignupCredentials = {
  name: string;
  storeName: string;
  /** ISO2 country code chosen by the user at signup. */
  countryCode?: string;
};

export type ForgottenPasswordCredentials = {
  email: string;
};

export type ResetPasswordCredentials = {
  password: string;
  accessToken: string;
  refreshToken: string | null;
};
