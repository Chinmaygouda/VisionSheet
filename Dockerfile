FROM node:18 as build-step
WORKDIR /app
COPY templates/package*.json ./
RUN npm install
COPY templates/ ./
RUN npm run build

FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn
COPY app.py .
COPY .env . 
COPY --from=build-step /app/dist ./templates/dist
ENV PORT 8080
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app