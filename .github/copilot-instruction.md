# Instruções do Copilot

## Tecnologias utilizadas

- Use HTML semântico, CSS puro e JavaScript vanilla no navegador.
- O servidor usa Node.js 20.6 ou superior e módulos nativos (`http`, `fs`, `path` e `fetch`); não requer pacotes npm nem etapa de build. O `.env` é carregado pelo argumento nativo `--env-file`.
- A integração de dados é a API NASA APOD. As fontes do Google Fonts são apenas visuais e têm alternativas locais definidas no CSS.
- Não introduza frameworks de frontend, bibliotecas de UI, bundlers, bancos de dados ou dependências externas sem necessidade aprovada.
- Não consulte a API da NASA diretamente do navegador; use o proxy local existente.

## Arquitetura do sistema

- `index.html`: estrutura e conteúdo semântico da página.
- `styles.css`: tema, componentes visuais, acessibilidade e comportamento responsivo.
- `app.js`: estado da interface, seleção/navegação de datas e apresentação de imagens e vídeos. Consulta somente `GET /api/apod?date=YYYY-MM-DD`.
- `server.js`: servidor HTTP local, allowlist de arquivos públicos e proxy da APOD. Valida a data, consulta a NASA e devolve os dados necessários à interface; se a API devolver o título genérico “NASA Science” ou uma imagem substituta (logo ou miniatura), completa título e imagem ou `iframe` de vídeo com os metadados da página oficial do APOD.
- `README.md`: instruções para executar o projeto e documentação da integração.
- Mantenha mudanças pequenas e coerentes com a separação entre interface e servidor; não duplique chamadas à API nem lógica de apresentação.

## Estilização do frontend

- Centralize estilos em `styles.css`; não adicione estilos inline nem frameworks CSS.
- Preserve a identidade visual existente: tema escuro inspirado no espaço, acento verde-lima, títulos serifados e texto auxiliar monoespaçado.
- Mantenha o layout funcional em telas móveis e desktop, incluindo os breakpoints existentes, foco visível, rótulos acessíveis e suporte a `prefers-reduced-motion`.
- Preserve alternativas de fontes e estados visíveis de carregamento, erro e mídia indisponível.

## Segurança

- Carregue `.env` somente no processo do servidor e leia a chave de `process.env.NASA_API_KEY`. Nunca a inclua no código, HTML, JavaScript do cliente, URL acessível ao navegador, resposta HTTP, logs ou commits.
- O navegador deve enviar apenas a data ao endpoint local; somente o servidor envia `api_key` à NASA.
- Não aceite uma chave enviada pelo cliente nem habilite CORS para contornar o proxy.
- Mantenha a allowlist de arquivos estáticos e não sirva arquivos do repositório, de ambiente ou de configuração.
- Valide datas no servidor e use mensagens de erro que não revelem a chave nem detalhes internos. Mantenha arquivos `.env` fora do Git.
