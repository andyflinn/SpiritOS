FROM node:latest
RUN mkdir -p /usr/src/app/zs4
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
RUN npm install
COPY ./* /usr/src/app/
RUN cp -R ./zs4/ /usr/src/app/zs4/
RUN ls -la /usr/src/app/*
EXPOSE 8080
CMD [ "npm", "start" ]
