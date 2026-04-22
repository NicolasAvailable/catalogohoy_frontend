export default {
  displayName: 'plan',
  preset: '../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../../coverage/libs/catalogohoy/plan',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: [
    // Transform these ESM-only packages — default is to skip node_modules,
    // but @jsverse/transloco ships untranspiled ESM (.js files using `export`)
    // and gets pulled in transitively through @catalogohoy/tenant → ui.
    'node_modules/(?!(.*\\.mjs$|@jsverse|lucide-angular|@sweet-monads|@ngrx))',
  ],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
