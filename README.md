# rapaziadahora

Produção em https://rapaziadahora.online. Aplicativo para compartilhar tela com até 12 amigos em salas privadas por convite. A interface usa cores escuras, detalhes âmbar e um Shiba animado em pixel art. Não há captura nem publicação de microfone.

## Como usar

Informe seu apelido, nome da sala e senha de criação. Envie o convite completo aos amigos. Cada pessoa escolhe um apelido e entra. A tela só é capturada ao clicar em compartilhar e confirmar o seletor do navegador. O áudio da aba pode acompanhar a tela, conforme o suporte do navegador. Use Chrome ou Edge atualizado no computador.

As telas têm volume individual, modo de destaque, tamanho ajustável e tela cheia. Há um controle para silenciar todas as telas recebidas e outro para mutar o áudio da própria transmissão. A qualidade padrão é 1080p/30 fps, com opções de 1080p/60 fps e 720p/30 fps. Resolução e fluidez dependem da tela, rede e computador.

## Limites gratuitos

Todos veem as cotas do plano LiveKit Build na sala e na página inicial.

| Recurso                         | Cota          |
| ------------------------------- | ------------- |
| Minutos de participante         | 5.000 por mês |
| Transferência de saída          | 50 GB por mês |
| Conexões simultâneas no projeto | 100           |
| Participantes nesta sala        | 12            |

Cada pessoa conectada consome um minuto da cota por minuto, mesmo sem compartilhar tela. As cotas são compartilhadas entre os projetos gratuitos da conta e renovam no dia 1. O painel exibe as cotas, não o saldo de consumo real da conta. Novas operações podem falhar após esgotá-las. Fonte conferida em 02/10/2026, [documentação do LiveKit](https://docs.livekit.io/deploy/admin/quotas-and-limits/).

## Configuração do servidor

Configure as variáveis no runtime do Sites. Marque as credenciais e senhas como segredos. No desenvolvimento local, use `.env`, ignorado pelo Git.

| Variável                      | Uso                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `LIVEKIT_URL`                 | URL WSS do projeto                                                              |
| `LIVEKIT_API_KEY`             | Chave de API LiveKit                                                            |
| `LIVEKIT_API_SECRET`          | Segredo de API LiveKit                                                          |
| `RAPAZIADAHORA_HOST_PASSWORD` | Senha para criar salas, com pelo menos 10 caracteres                            |
| `ELO_HOST_KEY`                | Segredo aleatório com pelo menos 32 caracteres, exclusivo para assinar o cookie |

`ELO_HOST_KEY` mantém seu nome por compatibilidade com a configuração já publicada. Não use a senha de criação para assinar cookies. O cookie de anfitrião usa HMAC, Secure, HttpOnly e SameSite=Strict e dura 7 dias. Rotacione o segredo de assinatura para invalidar sessões existentes ao trocar a senha.

O site público permite abrir a página. As salas continuam privadas por convite, e a criação exige a senha ou um cookie válido. Não há catálogo público de salas.

## Segurança

- E2EE é habilitada antes da conexão, sem fallback. A chave da mídia fica no fragmento `#` do convite e não é enviada ao backend. O link completo é uma credencial e deve ser compartilhado com cuidado.
- Convites e segredos de administração de sala têm 256 bits aleatórios. O banco guarda somente hashes SHA-256. O anfitrião mantém a credencial de encerrar a sala na memória da aba e no `sessionStorage`.
- Os tokens de conexão duram 60 segundos. Só permitem tela e áudio da tela na sala autorizada. Não permitem microfone, câmera, gravação, administração ou publicação de mensagens de dados. A política do navegador também bloqueia câmera e microfone.
- Convites expiram em 24 horas. Encerrar revoga o convite e solicita a desconexão no LiveKit. Tokens já emitidos podem ser reutilizados até a expiração, por até 60 segundos. Um cliente modificado pode manter uma conexão além do vencimento do convite.
- Tentativas de criar, entrar e encerrar salas têm limites persistentes no D1. Requisições verificam origem, tipo, tamanho e formato. O cabeçalho de IP deve vir de um proxy confiável.
- O aplicativo não grava, mas participantes podem gravar por outros meios. Metadados de sala e conexão não são E2EE. Um participante malicioso pode publicar várias telas; o anfitrião pode encerrar a sala inteira.

## Desenvolvimento e publicação

Use Node 22 atualizado ou Node 24 LTS. No Windows, Node 26 apresentou falha nativa no build original. Execute `npm ci`, `npm run db:local` e `npm run dev`.

`npm test` verifica autorização, convites, cookies, permissões dos JWT e limites de tentativas com SQLite real e mock do provedor. `npm run typecheck` verifica os tipos e `npm run build` gera o Worker. O lint completo ainda tem pendências em componentes legados e permanece informativo na CI.

A hospedagem usa o projeto existente identificado em `.openai/hosting.json`. Migrations em `drizzle/` são aplicadas pelo Sites. Não edite migrations já publicadas. Veja [EVOLUCAO.md](EVOLUCAO.md) para o fluxo de GitHub e publicação.

A ferramenta WebMCP `open_call_settings` apenas abre configurações de tela. Ela não inicia captura.
