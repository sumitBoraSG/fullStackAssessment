#FROM node:lts-buster
#Build step, on a heavier linux version.

FROM public.ecr.aws/sg/node:18-alpine as build
ARG NPM_TOKEN
COPY . /var/app/ts-bp-be

WORKDIR /var/app/ts-bp-be
RUN npm install
RUN npm run build

#lighter server image
FROM public.ecr.aws/sg/node:18-alpine
WORKDIR /var/app/ts-bp-be

#Copy package.json
COPY ./package*.json ./
#Copy prebuild dist
COPY --from=build /var/app/ts-bp-be/dist ./dist
COPY ./locales ./locales
COPY ./mail-template ./mail-template
COPY ./swagger-doc ./swagger-doc
#Copy npm pacakges with prod flag
RUN npm install --production