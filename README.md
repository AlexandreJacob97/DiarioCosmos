# Diário do Cosmos

Uma pequena aplicação web para explorar a Astronomy Picture of the Day (APOD)
da NASA. Escolha uma data para ver a imagem ou mídia e a explicação publicada
naquele dia.

## Executar

Não há dependências nem etapa de compilação. Gere uma chave gratuita em
<https://api.nasa.gov/> e coloque-a no arquivo `.env` (ignorado pelo Git) na
raiz do projeto:

```env
NASA_API_KEY=sua_chave
```

Com Node.js 20.6 ou superior, inicie o servidor na raiz:

```sh
node --env-file=.env server.js
```

Abra <http://localhost:8000>. O Node carrega a chave do arquivo para o ambiente
do servidor; ela não é enviada ao navegador. Não compartilhe nem versione o
arquivo `.env`. O navegador envia apenas a data ao servidor, que consulta a
NASA em seu nome.

## Como a API é usada

A página solicita `GET /api/apod?date=YYYY-MM-DD` ao servidor local. O servidor
faz então a requisição `GET` para
`https://api.nasa.gov/planetary/apod` usando estes parâmetros:

| Parâmetro | Uso |
| --- | --- |
| `api_key` | Valor da variável de ambiente `NASA_API_KEY`, enviado somente do servidor à NASA. |
| `date` | Data escolhida, no formato `YYYY-MM-DD`. A API também aceita `count` para imagens aleatórias ou `start_date` e `end_date` para um intervalo; esses parâmetros não são usados nesta interface. |

A resposta da APOD é um objeto JSON. A interface usa `date` (data), `title`
(título), `explanation` (descrição), `media_type` (tipo de mídia), `url`
(endereço da imagem ou vídeo), `hdurl` (imagem em alta resolução, quando
disponível) e `copyright` (crédito, quando disponível). Imagens são exibidas
na página e vídeos são incorporados quando há uma URL HTTPS válida. O proxy
repassa somente esses campos necessários para a interface. Quando a API
retorna o título genérico “NASA Science” ou uma imagem substituta (logo ou
miniatura genérica), o servidor recupera o título e os metadados da página
oficial do APOD para a data selecionada, incluindo o `iframe` de vídeos
incorporados.

Consulte a [documentação da API da NASA](https://api.nasa.gov/) e o
[repositório da APOD API](https://github.com/nasa/apod-api) para detalhes dos
parâmetros e da resposta.
