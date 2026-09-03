# TS-BP BE

# Pre-requisites

- node version >= 18.15.0
- Incase of lower version of node, upgrade the node version to minimum 18.15.0,
- Step 1: `sudo npm cache clean -f`
- Step 2: `sudo npm install -g n`
- Step 3: `sudo n lts` (here lts can be replaced with latest or stable as the version of node you want, lts is for long term support)
- user needs to create a PAT(personal access token) to be used for NPM_TOKEN, this is used in `.npmrc` file

# File and folder Naming conventions

- Folder and file name will be singular and follow `kebab-case`
- Classes and interfaces Names will be singular and follow `PascalCasing`
- Any global constants or environment variables are in `all-caps` and follow `SNAKE_CASE`
- Variable name should be `camelCase`

For more details onto casing refer [here](https://medium.com/better-programming/string-case-styles-camel-pascal-snake-and-kebab-case-981407998841)

# API

## Add new API

In order to add a new API resource,

- create a new controller in folder `src/app/controllers`
- in `src/app/routes` folder, add the resource in `index.ts` file and create another file for the routes of a particular resource. This file be then used in `index.ts` for mapping the resource and the routes.
- For API validation create a validator file in `src/app/validators` folder. This file should contain only the Joi object. For use of that object refer to `src/app/routes/userRoutes.ts`

## API Docs

Swagger is to be used for API documentation.

# Project Setup

To setup the project, all you need to do is :

- Copy default.env to .env and make necessary changes `cp default.env .env`
- (Optional but recommended) Search whole project and replace `ts-bp` with your app name i.e APPNAME (this will make changes in DOckerfile & compose file)
- `docker-compose up -d`
- High level flow would be `routes > validators > controllers > services > repository > model / entity`
- There are sample services files just for understanding code flow / structure. Build one service of your onw and then remove them.
-

# Run Migration

- To run migration `npm run migrate`

# Creating a new branch

- A new branch from any branch (main/dev or any other) must follow the syntax `^(feature|fix|hotfix|release)\/[A-Z]{1,}-[0-9]{1,}`. Eg: feature/SG-1 or feature/SG-1-health

# Deployment Changes

- Make changes in .yml files present in root folder (your ECR repo etc)

# DB

This project uses typeorm for orm to connect and execute queries on DB. It is configured to use postgres as its database.

`synchronize` is set to `false` (see `ormconfig.ts` / `src/database/db-connection.ts`) — the schema is **not** auto-updated from entity changes. Schema changes must go through a migration under `src/database/migration/` and `npm run migrate`. See `TECHNICAL_DOCUMENTATION.md` at the repo root for the full schema and an ER diagram.

# Module Aliases

This project setup uses some module aliases for the ease in readbility and importing of other modules.
Refer to `_moduleAliases` section in `package.json` for currently created module aliases. These aliases are workable in src folder only as of now

# Commit Messages

- Commit message to be in the format as `feat(SG-123): message specifying the feature developed`. Like wise, the message alias can be reffered to the regexp defined in `commitlint.config.js`. Message syntax to follow `type(Ticket_ID): commit message`
