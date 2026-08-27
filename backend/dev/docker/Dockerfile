#FROM node:lts-buster
# Install node dependencies and sync folders

FROM public.ecr.aws/sg/node:18-alpine as build
COPY . /var/app/ts-bp-be

WORKDIR /var/app/ts-bp-be
RUN npm install