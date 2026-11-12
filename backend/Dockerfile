# Use Python 3.12 slim image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install wheel for faster builds
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements
COPY requirements.txt .

# Install dependencies with increased timeout and retries
# Split into smaller chunks to avoid timeout
RUN pip install --no-cache-dir --timeout=1000 --retries=5 \
    fastapi==0.109.0 \
    uvicorn[standard]==0.27.0 \
    python-multipart==0.0.6 \
    pydantic==2.5.3 \
    pydantic-settings==2.1.0 \
    python-dotenv==1.0.0 \
    httpx==0.26.0

# Install google-generativeai separately (it's large)
RUN pip install --no-cache-dir --timeout=1000 --retries=5 \
    google-generativeai==0.3.2

# Install sentence-transformers last (largest, ~2GB)
RUN pip install --no-cache-dir --timeout=1000 --retries=5 \
    sentence-transformers==2.2.2

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p database

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV API_HOST=0.0.0.0
ENV API_PORT=8000

# Run the application
CMD ["python", "main.py"]
