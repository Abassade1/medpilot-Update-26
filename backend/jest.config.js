module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testTimeout: 30000,
  globalSetup: "<rootDir>/test/global-setup.ts",
  transform: { "^.+\\.ts$": ["ts-jest", { isolatedModules: true, diagnostics: false }] },
};
