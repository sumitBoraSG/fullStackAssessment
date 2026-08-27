import { ConnectionOptions } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import { DATABASE_URL } from "./src/config/secret";
import path from "path";

const config: ConnectionOptions = {
  type: "postgres",
  url: DATABASE_URL,

  entities: [path.resolve("./src/database/model/*.{ts,js}")],
  migrations: [path.resolve("./src/database/migration/*.{ts,js}")],

  synchronize: false,
  logging: false,

  namingStrategy: new SnakeNamingStrategy(),
};

export = config;