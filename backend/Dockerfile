FROM python:3.11-slim

WORKDIR /app

# System deps. opencv-python-headless still needs libglib2.0-0.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (cacheable layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Railway/Render inject PORT. Default to 8000 for `docker run` locally.
ENV PORT=8000
EXPOSE 8000

# Use shell form so $PORT expands at runtime.
CMD python server.py
