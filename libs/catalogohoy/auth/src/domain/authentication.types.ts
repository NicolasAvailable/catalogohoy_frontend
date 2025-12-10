export type LoginCredentials = {
  email: string;
  password: string;
};

export type SignUpCredentials = {
  name: string;
  phone: string;
  email: string;
  storeName: string;
  password: string;
};

export type ForgottenPasswordCredentials = {
  email: string;
};

export type ResetPasswordCredentials = {
  password: string;
  accessToken: string;
  refreshToken: string | null;
};
