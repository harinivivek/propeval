FROM node:20-slim

# Create a non-privileged user with a home directory for npm cache
RUN groupadd -r appuser && useradd -m -r -g appuser appuser

WORKDIR /app

# Set ownership of the workdir before switching users
RUN chown appuser:appuser /app

USER appuser

COPY --chown=appuser:appuser package.json package-lock.json* ./
RUN npm install

COPY --chown=appuser:appuser . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
