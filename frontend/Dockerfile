# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
# No package-lock committed; `npm install` resolves within the ranges above.
RUN npm install
COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine
# curl is included so you can run the network verification command
# from inside the frontend container.
RUN apk add --no-cache curl
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
