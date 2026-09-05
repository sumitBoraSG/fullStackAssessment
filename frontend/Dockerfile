# Dev-mode image: runs the Vite dev server for team-preview use, matching
# how the app is already run locally. Not a production build (no Nginx,
# no static bundling) — see TECHNICAL_DOCUMENTATION.md if that's needed later.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
