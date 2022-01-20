# syntax=docker/dockerfile:1
FROM node:16-alpine
WORKDIR /home/node/app
COPY . .
RUN yarn
RUN chown -R node:node .
CMD [ "node_modules/.bin/jest" ]
