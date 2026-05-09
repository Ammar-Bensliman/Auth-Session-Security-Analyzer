FROM python:3.11-slim

# Eviter l'écriture de bytecode et forcer le flush stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Chemin Python — s'assure que les binaires pip (semgrep, etc.) sont dans le PATH
ENV PATH="/usr/local/bin:${PATH}"
# Répertoire de travail Python (pour les imports backend.*)
ENV PYTHONPATH="/app"
# Désactiver les téléchargements HuggingFace bruyants
ENV TOKENIZERS_PARALLELISM=false
ENV HF_HUB_DISABLE_PROGRESS_BARS=1
ENV TRANSFORMERS_VERBOSITY=error

# ── Dépendances système ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget unzip git \
    default-jre \
    build-essential python3-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Apktool (décompilation APK) ───────────────────────────────────────────────
RUN echo '#!/bin/sh\nexec java -jar /usr/local/bin/apktool.jar "$@"' > /usr/local/bin/apktool \
    && chmod +x /usr/local/bin/apktool \
    && wget -4 https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar \
        -O /usr/local/bin/apktool.jar \
    && chmod +x /usr/local/bin/apktool.jar

# ── JADX (décompilation Java) ─────────────────────────────────────────────────
ENV JADX_VERSION=1.4.7
RUN wget -4 https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip \
    && unzip -q jadx-${JADX_VERSION}.zip -d /opt/jadx \
    && ln -s /opt/jadx/bin/jadx /usr/local/bin/jadx \
    && rm jadx-${JADX_VERSION}.zip

# ── Dépendances Python ─────────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt /app/
RUN pip install --upgrade pip --no-cache-dir \
    && pip install --no-cache-dir -r requirements.txt

# ── Copie du code backend ──────────────────────────────────────────────────────
# On copie dans /app/backend/ (structure attendue par les imports Python)
COPY . /app/backend/

# ── Création des répertoires de données persistants ───────────────────────────
# /app/data/ est le répertoire de données partagé (uploads, extracts, chroma_db)
RUN mkdir -p /app/data/uploads /app/data/extracts /app/data/chroma_db

# ── Variables d'environnement pour les chemins ────────────────────────────────
ENV UPLOAD_DIR=/app/data/uploads
ENV EXTRACT_DIR=/app/data/extracts
ENV CHROMA_DIR=/app/data/chroma_db

# Port FastAPI
EXPOSE 8000

# ── Démarrer FastAPI ──────────────────────────────────────────────────────────
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
