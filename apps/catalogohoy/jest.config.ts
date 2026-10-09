export default {
  displayName: 'catalogohoy',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/catalogohoy',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // Mismo allowlist que las libs: transloco (@jsverse) y cía. publican ESM.
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@jsverse|lucide-angular|@sweet-monads|@ngrx))',
  ],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
