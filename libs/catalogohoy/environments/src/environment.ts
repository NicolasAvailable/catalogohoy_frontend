import { authenticationEnvironment } from './authentication/environment';
import { globalEnvironment } from './global/global.environment';

export const environment = {
  ...globalEnvironment,
  ...authenticationEnvironment,
};
