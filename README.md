# Phisys

**Aplicativo Educacional Gamificado de Fisiologia Cardiovascular & Renal**

Phisys é um objeto de aprendizagem gamificado (Serious Game) voltado a estudantes de graduação nas áreas de saúde e ciências biológicas. O aplicativo simula situações fisiológicas por meio de um mascote virtual, substituindo ou complementando aulas práticas com animais vivos em laboratório.

---

## Sobre o Projeto

O Phisys foi desenvolvido como alternativa ética e pedagógica às aulas práticas de Fisiologia com animais vivos. O aluno controla um mascote virtual cujos cinco parâmetros fisiológicos devem ser mantidos dentro das faixas normais por meio de respostas corretas a desafios progressivos.

Focos pedagógicos:
- Fisiologia Cardiovascular — pressão arterial e frequência cardíaca
- Fisiologia Renal — sede, fome e volume urinário

---

## Funcionalidades

- Mascote virtual com 5 parâmetros fisiológicos em tempo real
- Sistema gamificado de perguntas, desafios e cartas de intervenção
- Dois modos: Modo Livre e Modo Sessão (com professor)
- Ranking individual com XP, pontuação e nota
- Painel do professor com nota automática e ajuste manual
- PWA — instalável no celular sem passar pela loja de aplicativos

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React (JavaScript) |
| PWA | Service Worker + Web App Manifest |
| Backend (em desenvolvimento) | Node.js + Express |
| Banco de dados (em desenvolvimento) | SQLite |

---

## Como Rodar Localmente

### Pré-requisitos

Antes de começar, instale os seguintes programas na ordem abaixo:

1. Node.js — https://nodejs.org (baixe a versão LTS)
2. Git — https://git-scm.com/download/win (instale com todas as opções padrão)

Atenção: o GitHub Desktop é diferente do Git para terminal. É necessário instalar o Git pelo link acima mesmo que já tenha o GitHub Desktop instalado.

Após instalar, feche e reabra o PowerShell antes de continuar.

### Acesso ao repositório

O repositório é privado. Para cloná-lo você precisa:
- Ter uma conta no GitHub
- Ter sido adicionada como colaboradora pela desenvolvedora
- Quando solicitado, informar seu usuário e senha do GitHub no terminal

### Passo a passo

Abra o PowerShell e execute os comandos abaixo, um de cada vez, esperando cada um terminar antes de digitar o próximo:

Passo 1 — Clone o repositório:
git clone https://github.com/RitaJeronimo/Phisys.git

Passo 2 — Entre na pasta do frontend:
cd Phisys/frontend

Passo 3 — Instale as dependências:
npm install

Passo 4 — Rode o app:
npm start

O app abrirá automaticamente no navegador em http://localhost:3000

### Erros comuns

- git não é reconhecido: o Git não está instalado. Baixe em https://git-scm.com/download/win, instale e reabra o PowerShell.
- Não é possível localizar o caminho: você pulou o Passo 1 ou o clone não foi concluído. Volte ao Passo 1.
- npm error ENOENT: você está na pasta errada. Certifique-se de ter executado o Passo 2 antes do npm install.

---

## Estrutura do Projeto

- frontend/src/engine/mascotEngine.js — Motor fisiológico central
- frontend/src/screens/LoginScreen.js — Tela de login
- frontend/src/screens/HomeScreen.js — Menu principal
- frontend/src/screens/GameScreen.js — Tela do jogo
- frontend/src/screens/RankingScreen.js — Ranking
- frontend/src/screens/ProfessorPanel.js — Painel do professor
- CITATION.cff — Citação acadêmica
- LICENSE — Licença MIT

---

## Citação Acadêmica

Se você usar este software em sua pesquisa, por favor cite conforme o arquivo CITATION.cff:

Jerônimo da Silva, R. C. (2026). Phisys — Gamified Educational Application for Cardiovascular and Renal Physiology (v0.1.0). https://github.com/RitaJeronimo/Phisys

---

## Licença

Este projeto está licenciado sob a MIT License. Veja o arquivo LICENSE para mais detalhes.

---

## Autora

Rita de Cássia Jerônimo da Silva
Doutora em Ciência da Computação — CIn/UFPE
ORCID: https://orcid.org/0009-0006-6534-1027