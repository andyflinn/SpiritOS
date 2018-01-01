FROM node:latest
RUN mkdir -p /usr/src/app/
RUN mkdir -p /usr/src/app/data
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
RUN npm install
COPY ./.zs4                 /usr/src/app/
COPY ./app.yaml             /usr/src/app/
COPY ./docker-compose.yml   /usr/src/app/
COPY ./package.json         /usr/src/app/
COPY ./package-lock.json    /usr/src/app/
COPY ./zs4.js               /usr/src/app/

RUN mkdir -p /usr/src/app/zs4/
COPY ./zs4/email.js         /usr/src/app/zs4/
COPY ./zs4/express.js       /usr/src/app/zs4/
COPY ./zs4/fs.js            /usr/src/app/zs4/
COPY ./zs4/html.js          /usr/src/app/zs4/
COPY ./zs4/mongodb.js       /usr/src/app/zs4/
COPY ./zs4/password.js      /usr/src/app/zs4/
COPY ./zs4/rsa.js           /usr/src/app/zs4/
COPY ./zs4/token.js         /usr/src/app/zs4/
COPY ./zs4/um.js            /usr/src/app/zs4/
COPY ./zs4/user.js          /usr/src/app/zs4/

RUN mkdir -p /usr/src/app/zs4/plugin/toonsmith/static/toonsmith/

COPY ./zs4/plugin/toonsmith/toonsmith.js                  /usr/src/app/zs4/plugin/toonsmith/
COPY ./zs4/plugin/toonsmith/static/toonsmith/script.js    /usr/src/app/zs4/plugin/toonsmith/static/toonsmith/
COPY ./zs4/plugin/toonsmith/static/toonsmith/style.css    /usr/src/app/zs4/plugin/toonsmith/static/toonsmith/
COPY ./zs4/plugin/toonsmith/static/toonsmith/window.js    /usr/src/app/zs4/plugin/toonsmith/static/toonsmith/

RUN mkdir -p /usr/src/app/zs4/static/tables/

COPY ./zs4/static/admin.js       /usr/src/app/zs4/static/
COPY ./zs4/static/bowser.min.js  /usr/src/app/zs4/static/
COPY ./zs4/static/favicon.ico    /usr/src/app/zs4/static/
COPY ./zs4/static/style.css      /usr/src/app/zs4/static/
COPY ./zs4/static/zs4.js         /usr/src/app/zs4/static/
COPY ./zs4/static/tables/midi.js /usr/src/app/zs4/static/tables

RUN ls -la /usr/src/app/zs4
EXPOSE 8080
CMD [ "npm", "start" ]
