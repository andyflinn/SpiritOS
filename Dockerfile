FROM node:latest
RUN mkdir -p /usr/src/app/
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
RUN npm install
COPY ./                                 /usr/src/app/
COPY ./zs4                              /usr/src/app/zs4
COPY ./zs4/plugin                       /usr/src/app/zs4/plugin
COPY ./zs4/plugin/static/               /usr/src/app/zs4/plugin/static
COPY ./zs4/plugin/static/toonsmith      /usr/src/app/zs4/plugin/static/toonsmith
COPY ./zs4/static                       /usr/src/app/zs4/static
COPY ./zs4/static/tables                /usr/src/app/zs4/static/tables
RUN ls -la /usr/src/app/zs4
EXPOSE 8080
CMD [ "npm", "start" ]
