export const EMAIL_REGEX =
  /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const URL_REGEX =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

export const URL_GLOBAL =
  /[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=\-]{2,256}\.[a-z]{2,9}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;

export const LINKEDIN_COMPANY_REGEX = /https:\/\/www\.linkedin\.com\/company\//;
