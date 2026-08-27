module.exports = {
    globals: {
        "ts-jest": {
            tsConfig: "tsconfig.json",
        },
    },
    moduleFileExtensions: [
        "ts",
        "js",
    ],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest",
    },
    testMatch: [
        "**/test/**/*.test.(ts|js)",
    ],
    testEnvironment: "node",

    "moduleNameMapper": {
        "@src/([^\\.]*)$": "<rootDir>/src/$1",
        "@api/([^\\.]*)$": "<rootDir>/src/api/$1",
        "@cache/([^\\.]*)$": "<rootDir>/src/cache/$1",
        "@config/([^\\.]*)$": "<rootDir>/src/config/$1",
        "@core/([^\\.]*)$": "<rootDir>/src/core/$1",
        "@database/([^\\.]*)$": "<rootDir>/src/database/$1",
        "@middleware/([^\\.]*)$": "<rootDir>/src/middleware/$1",
        "@service/([^\\.]*)$": "<rootDir>/src/service/$1",
        "@type/([^\\.]*)$": "<rootDir>/src/type/$1",
        "@util/([^\\.]*)$": "<rootDir>/src/util/$1",
        
    }
};
