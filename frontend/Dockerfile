FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN corepack enable && yarn install --non-interactive

ARG REACT_APP_BACKEND_URL=
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}

COPY . .
RUN yarn build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
