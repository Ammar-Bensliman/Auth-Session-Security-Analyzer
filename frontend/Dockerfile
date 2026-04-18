FROM node:20-alpine

WORKDIR /app

# Enable legacy peer deps often needed for Recharts / Tailwind setup
COPY package*.json ./
RUN npm install || true

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
