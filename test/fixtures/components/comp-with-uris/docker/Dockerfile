FROM registry.access.redhat.com/ubi8/nodejs-18:latest

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
