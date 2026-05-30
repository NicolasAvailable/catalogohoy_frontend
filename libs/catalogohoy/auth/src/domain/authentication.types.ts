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
  /** Código de afiliado capturado de la cookie chy_ref o tipeado a mano.
   *  Vacío/null = no es un referido. Se resuelve contra register_referral RPC. */
  referralCode?: string | null;
};

export type GoogleSignupCredentials = {
  name: string;
  storeName: string;
  /** ISO2 country code chosen by the user at signup. */
  countryCode?: string;
  referralCode?: string | null;
};

export type ForgottenPasswordCredentials = {
  email: string;
};

export type ResetPasswordCredentials = {
  password: string;
  accessToken: string;
  refreshToken: string | null;
};
