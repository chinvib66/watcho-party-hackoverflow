FROM node:12

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY package.json ./

RUN npm install --silent

COPY . ./

# start app
CMD ["npm", "start"]
