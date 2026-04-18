import os
import json
import logging
import warnings

# ── Supprimer les warnings bruyants du chargement HuggingFace / transformers ──
# Ces messages n'indiquent pas d'erreur fonctionnelle
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

# Supprimer le warning "unauthenticated requests to HF Hub"
warnings.filterwarnings("ignore", message=".*unauthenticated.*")
warnings.filterwarnings("ignore", message=".*hf_hub.*")

# Réduire les logs transformers/sentence_transformers au niveau ERROR
for _logger_name in (
    "transformers",
    "sentence_transformers",
    "huggingface_hub",
    "huggingface_hub.utils._validators",
):
    logging.getLogger(_logger_name).setLevel(logging.ERROR)

import chromadb
from chromadb.utils import embedding_functions
from backend.core.config import settings


class RAGEngine:
    def __init__(self):
        # Répertoire ChromaDB (chemin absolu, compatible Windows & Linux/Docker)
        db_path = settings.CHROMA_DIR
        os.makedirs(db_path, exist_ok=True)

        self.client = chromadb.PersistentClient(path=db_path)

        # Embeddings locaux — all-MiniLM-L6-v2 (pas d'API Key requis)
        # Le warning "UNEXPECTED embeddings.position_ids" est inoffensif :
        # il vient d'une différence de tâche entre le modèle original et
        # sentence-transformers ; le modèle fonctionne correctement.
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )

        # Collection MASVS (créée si absente)
        self.collection = self.client.get_or_create_collection(
            name="masvs_auth_knowledge",
            embedding_function=self.embedding_fn,
        )

        self._initialize_knowledge_base_if_empty()

    def _initialize_knowledge_base_if_empty(self):
        """Peuple la base vectorielle avec les guidelines MASVS si elle est vide."""
        if self.collection.count() > 0:
            return

        print("[RAG] Base vide — indexation MASVS depuis le fichier JSON...")

        # Chemin absolu : backend/ai/ → backend/ → backend/rules/masvs/
        rules_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "rules", "masvs", "masvs_auth_full.json"
        )

        if not os.path.exists(rules_path):
            print(f"[RAG] ⚠️  Fichier MASVS introuvable : {rules_path}")
            return

        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                rules = json.load(f)

            documents, ids, metadatas = [], [], []
            for rule in rules:
                doc = (
                    f"{rule['id']} — {rule['title']}: "
                    f"{rule['description']} "
                    f"Remédiation: {rule.get('remediation', '')}"
                )
                documents.append(doc)
                ids.append(rule["id"])
                metadatas.append({
                    "source": "MASVS-v2",
                    "mastg_tests": ", ".join(rule.get("mastg_tests", [])),
                })

            self.collection.add(documents=documents, metadatas=metadatas, ids=ids)
            print(f"[RAG] ✅ Indexation terminée : {len(documents)} règles MASVS ajoutées.")

        except Exception as e:
            print(f"[RAG] ❌ Erreur d'indexation : {e}")

    def retrieve_context(self, query: str, n_results: int = 5) -> str:
        """Récupère les guidelines MASVS les plus pertinentes pour le prompt IA."""
        try:
            count = self.collection.count()
            if count == 0:
                return ""
            n = min(n_results, count)
            results = self.collection.query(query_texts=[query], n_results=n)
            return "\n\n".join(results["documents"][0])
        except Exception as e:
            print(f"[RAG] Erreur lors de la récupération : {e}")
            return ""
