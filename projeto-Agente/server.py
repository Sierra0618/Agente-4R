import os
import sys
import logging
from typing import Optional
from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("azure_agent_server")

# Configuration (from agente.py)
ENDPOINT = "https://aula-agente-lucas-resource.services.ai.azure.com/api/projects/aula-agente-lucas"
AGENT_NAME = "Jesus-Sierra"

# System Prompt - Modelo de Agente Híbrido IA+IH (Matriz Base)
SYSTEM_INSTRUCTION_IA_IH = """[INSTRUÇÃO DO SISTEMA — MODELO DE AGENTE HÍBRIDO IA+IH]
Você é um assistente de IA que ajuda as pessoas a encontrar informações, solucionar problemas e tomar decisões estruturadas.
Sua identidade é a combinação de IA (processamento de dados, identificação de padrões, velocidade e síntese) com IH (intenção, julgamento, valores e contexto humano).

Sua espinha dorsal de raciocínio é a MATRIZ BASE:

1. PERGUNTAS CONTEXTUAIS (Gatilhos de Interpretação / Análise de Desvio):
   - Por que (e Por que não)
   - Como (e Como não)
   - Quem (e Quem não)
   - O que (e O que não)
   - Onde (e Onde não — ex.: na área de motores vs onde não ocorre)
   - Quando (e Quando não — momentos em que o desvio ocorre vs quando não ocorre)
   * Regra do Desvio: Sempre explicitar a relação 'Deveria ser' vs 'Realidade'.

2. QUATRO DIMENSÕES DE ANÁLISE (4Rs):
   - Recursos: O que falta? O que sobra? (Pessoas, capacitação, ferramentas, máquinas, dados, tempo, orçamento, documentação).
   - Relacionamentos: Quem depende de quem? (Comunicação entre áreas, turnos, clientes internos/externos, handoffs, alinhamento).
   - Rumo: Estamos indo na direção certa? (Alinhamento estratégico, metas claras, prioridade correta, valor agregado).
   - Resultados: O que está sendo alcançado? (Tempo de ciclo, qualidade, retrabalho, produtividade, estabilidade).

3. SEIS AÇÕES COGNITIVAS (aplicadas às 4 dimensões):
   - Multiplicar: Ampliar ou escalar o que funciona.
   - Renovar: Substituir, atualizar ou ajustar.
   - Deixar como está: Manter o que já está estável.
   - Diminuir: Reduzir desperdícios, etapas redundantes ou gargalos.
   - Dividir: Separar, segmentar ou quebrar em partes menores.
   - Adicionar: Incluir novas etapas, padrões, controles ou capacitações.

FLUXO DE DECISÃO IA+IH:
Entrada → Pergunta Contextual (Deveria x Realidade) → Avaliação das 4 Dimensões (Recursos, Relacionamentos, Rumo, Resultados) → Escolha da Ação Cognitiva → IA Sugere (padrões e alternativas) → IH Decide (validação no contexto humano) → Saída Estruturada / Prompt Otimizado.

SEMPRE responda de forma clara, prática, organizada e visual (usando títulos, tópicos e tabelas quando aplicável), seguindo esta estrutura da Matriz Base.
"""

# Global client references
azure_credential = None
azure_project_client = None
azure_openai_client = None


def init_azure_client():
    """Initializes the Azure AI Project Client and OpenAI Client."""
    global azure_credential, azure_project_client, azure_openai_client
    logger.info("Initializing Azure AI Project Client...")
    try:
        azure_credential = DefaultAzureCredential()
        azure_project_client = AIProjectClient(
            endpoint=ENDPOINT,
            credential=azure_credential,
            allow_preview=True,
        )
        azure_openai_client = azure_project_client.get_openai_client(agent_name=AGENT_NAME)
        logger.info(f"Connected to Azure AI Foundry Agent: {AGENT_NAME}")
    except Exception as e:
        logger.error(f"Failed to initialize Azure AI client: {e}")
        raise e


def close_azure_client():
    """Cleans up Azure clients upon shutdown."""
    global azure_credential, azure_project_client
    if azure_project_client:
        try:
            azure_project_client.close()
        except Exception:
            pass
    if azure_credential:
        try:
            azure_credential.close()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_azure_client()
    yield
    # Shutdown
    close_azure_client()


app = FastAPI(
    title="Agente Híbrido IA+IH - Microsoft Foundry Studio",
    description="Interface Web para o Agente Híbrido IA+IH com Matriz Base (Perguntas, 4Rs e Ações Cognitivas)",
    version="1.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Models
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Mensagem do usuário")
    conversation_id: Optional[str] = Field(None, description="ID da conversa existente no Azure")
    is_first_message: Optional[bool] = Field(False, description="Indica se é a primeira mensagem da conversa")

class ChatResponse(BaseModel):
    reply: str
    conversation_id: str

class AgentInfoResponse(BaseModel):
    agent_name: str
    endpoint: str
    status: str
    model_type: str = "Agente Híbrido IA+IH (Matriz Base)"


# API Endpoints
@app.get("/api/agent-info", response_model=AgentInfoResponse)
async def get_agent_info():
    """Retorna informações sobre o Agente configurado."""
    return AgentInfoResponse(
        agent_name=AGENT_NAME,
        endpoint=ENDPOINT,
        status="online" if azure_openai_client is not None else "offline",
        model_type="Agente Híbrido IA+IH (Matriz Base)"
    )


@app.get("/api/methodology")
async def get_methodology():
    """Retorna os dados conceituais da Matriz Base IA+IH."""
    return {
        "title": "Modelo de Agente Híbrido IA+IH",
        "pillars": {
            "questions": ["Por que (e por que não)", "Como (e como não)", "Quem (e quem não)", "O que (e o que não)", "Onde (e onde não)", "Quando (e quando não)"],
            "dimensions_4r": {
                "Recursos": "O que falta? O que sobra? (Pessoas, ferramentas, dados, tempo, infraestrutura)",
                "Relacionamentos": "Quem depende de quem? (Comunicação, colaboração, handoffs)",
                "Rumo": "Estamos indo na direção certa? (Alinhamento estratégico, metas, prioridades)",
                "Resultados": "O que está sendo alcançado? (Métricas, qualidade, tempo, valor gerado)"
            },
            "actions": {
                "Multiplicar": "Ampliar ou escalar o que funciona bem",
                "Renovar": "Substituir, atualizar ou ajustar",
                "Deixar como está": "Manter o que está estável e eficiente",
                "Diminuir": "Reduzir desperdícios, etapas desnecessárias ou gargalos",
                "Dividir": "Separar, segmentar ou quebrar o problema em partes menores",
                "Adicionar": "Incluir novas etapas, padrões, controles ou capacitação"
            }
        },
        "system_instruction": SYSTEM_INSTRUCTION_IA_IH
    }


@app.post("/api/new-conversation")
async def create_new_conversation():
    """Cria uma nova conversa no Azure OpenAI Client para isolar o histórico."""
    if not azure_openai_client:
        raise HTTPException(status_code=503, detail="Cliente Azure AI não inicializado.")

    def _create():
        return azure_openai_client.conversations.create()

    try:
        conversation = await asyncio.to_thread(_create)
        return {"conversation_id": conversation.id}
    except Exception as e:
        logger.error(f"Erro ao criar nova conversa: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Envia uma mensagem para o agente no Microsoft Foundry e retorna a resposta com a Matriz IA+IH."""
    if not azure_openai_client:
        raise HTTPException(status_code=503, detail="Cliente Azure AI não inicializado.")

    conv_id = request.conversation_id
    is_first = request.is_first_message or (conv_id is None)

    def _execute_turn():
        nonlocal conv_id
        # Se não houver conversa ativa fornecida, cria uma nova no Azure
        if not conv_id:
            conv = azure_openai_client.conversations.create()
            conv_id = conv.id

        # Se for a primeira mensagem da conversa, injeta o guia metodológico IA+IH
        if is_first:
            payload_content = f"{SYSTEM_INSTRUCTION_IA_IH}\n\n[Mensagem do Usuário]:\n{request.message}"
        else:
            payload_content = request.message

        resp = azure_openai_client.responses.create(
            conversation=conv_id,
            input=[{"role": "user", "content": payload_content}],
        )
        return resp.output_text, conv_id

    try:
        reply_text, active_conv_id = await asyncio.to_thread(_execute_turn)
        return ChatResponse(
            reply=reply_text,
            conversation_id=active_conv_id
        )
    except Exception as e:
        logger.error(f"Erro ao processar mensagem no Azure Agent: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao comunicar com o agente: {str(e)}"
        )


# Servir Frontend
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Interface Web do Agente Microsoft Foundry", "static_dir": STATIC_DIR}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
