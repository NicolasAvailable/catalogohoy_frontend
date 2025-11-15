import { authenticationEnvironment } from './authentication/environment.development';
import { globalEnvironment } from './global/global.development';

export const environment = {
  ...globalEnvironment,
  ...authenticationEnvironment,
};
