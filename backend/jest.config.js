module.exports = {
    moduleFileExtensions: [
        "ts",
        "js",
    ],
    transform: {
        "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.json" }],
    },
    testMatch: [
        "**/test/**/*.test.(ts|js)",
    ],
    setupFiles: [
        "<rootDir>/test/util/testEnv.ts",
    ],
    testEnvironment: "node",
    testTimeout: 20000,

    "moduleNameMapper": {
        "^@src/(.*)$": "<rootDir>/src/$1",
        "^@api/(.*)$": "<rootDir>/src/api/$1",
        "^@cache/(.*)$": "<rootDir>/src/cache/$1",
        "^@config/(.*)$": "<rootDir>/src/config/$1",
        "^@core/(.*)$": "<rootDir>/src/core/$1",
        "^@database/(.*)$": "<rootDir>/src/database/$1",
        "^@middleware/(.*)$": "<rootDir>/src/middleware/$1",
        "^@service/(.*)$": "<rootDir>/src/service/$1",
        "^@type/(.*)$": "<rootDir>/src/type/$1",
        "^@util/(.*)$": "<rootDir>/src/util/$1"
    }
};
