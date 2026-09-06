# Elo

Aplicativo privado para conversar por voz e compartilhar tela com até 12 amigos. Interface em português, sem cadastro individual: o anfitrião cria a sala e os amigos entram por convite.

## Estado da entrega

O Elo está conectado ao projeto LiveKit Cloud elochat. A página foi liberada pelo proprietário; as salas continuam protegidas por convites privados, e só o anfitrião pode criar salas. A conta LiveKit permanece no plano Build, sem contratação de plano pago.

## Ativação

1. Crie um projeto em [LiveKit Cloud](https://cloud.livekit.io/) ou use um [servidor próprio](https://docs.livekit.io/transport/self-hosting/). O servidor precisa de WSS com certificado válido, HTTPS na API e conectividade TURN para redes restritas.
2. Preencha as variáveis abaixo no ambiente do servidor, nunca no código do navegador. No Sites, configure como variáveis de runtime; marque as três chaves como secretas. Para desenvolvimento local, use `.env`, ignorado pelo Git.

| Variável             | Valor                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| `LIVEKIT_URL`        | URL `wss://` do projeto                                                               |
| `LIVEKIT_API_KEY`    | Chave de API do LiveKit                                                               |
| `LIVEKIT_API_SECRET` | Segredo de API do LiveKit                                                             |
| `ELO_HOST_KEY`       | Segredo aleatório com pelo menos 32 caracteres, usado pelo anfitrião para criar salas |

Gere a chave do anfitrião com um gerenciador de senhas. Ela não deve ser enviada aos convidados. A conta existente foi conectada; não houve contratação de plano pago. A chave gerada pelo proprietário é armazenada no runtime do Sites como segredo. Após a primeira criação de sala, o anfitrião recebe um cookie assinado, Secure e HttpOnly válido por 7 dias. Trocar ELO_HOST_KEY invalida essas sessões.

3. No Sites, permita o acesso dos amigos pela política de acesso da plataforma. A proteção do convite continua sendo exigida pelo aplicativo. Alterar o site para público exige uma decisão explícita do proprietário.
4. Abra o Elo por HTTPS no Chrome ou Edge atualizado, informe seu apelido, o nome da sala e a chave do anfitrião. Crie a sala e copie o convite. A outra pessoa abre o link, informa um apelido e entra.

## Desenvolvimento

Node >=22.13 e npm. `npm ci`, `npm run db:local`, `npm run dev`. O estado D1 local fica em `.wrangler`. Não exponha o servidor de desenvolvimento à internet.

`npm test` executa os testes de autorização, emissão de tokens e validação de requisições. `npm run typecheck` valida TypeScript. `npm run build` gera o Worker e os recursos públicos. Migrations em `drizzle/` são aplicadas pelo Sites na publicação. Não edite migrations já publicadas.

## Voz e tela

- Voz via Opus, com cancelamento de eco, redução de ruído, recuperação de perdas e perfil de áudio de alta qualidade.
- Compartilhamento configurável: 1080p/60 fps, 1080p/30 fps ou 720p/30 fps. Esses valores são limites solicitados; desempenho depende de navegador, rede, tela e equipamento.
- Recepção adaptativa e simulcast pelo LiveKit. O limite de 12 participantes é imposto no servidor de mídia.
- Áudio de tela depende do navegador e do sistema. Para compartilhar áudio de uma aba, selecione a aba e marque a opção de áudio no seletor do navegador.
- Smartphones podem ouvir e assistir, mas muitos navegadores móveis não oferecem compartilhamento de tela ou o suporte de criptografia exigido. O aplicativo não desativa a criptografia para contornar incompatibilidade.

## Segurança e limites

- Criptografia de ponta a ponta habilitada antes da conexão. A chave de mídia é gerada com Web Crypto no navegador e vai no fragmento `#` do convite; não é enviada ao backend do Elo. Não há fallback para chamada sem E2EE.
- Segredos de convite e de anfitrião da sala: 256 bits aleatórios. O banco guarda apenas os hashes SHA-256. O segredo de administração fica no estado da aba e em `sessionStorage` para sobreviver ao recarregamento.
- O link é uma credencial: quem receber o link completo pode entrar e ler a mídia. Compartilhe por um canal confiável. O fragmento pode ficar no histórico do navegador; extensões ou um dispositivo comprometido também podem acessá-lo.
- Tokens LiveKit com 60 segundos para a conexão inicial, limitados à sala, microfone e tela. Sem permissões de gravação, câmera, administração ou publicação de mensagens de dados.
- Convites expiram após 24 horas. O cliente sai no vencimento. Um cliente modificado pode manter uma sessão já conectada além desse prazo; o anfitrião pode encerrar a sala no servidor.
- Encerrar revoga convites antes de solicitar a desconexão de todos no LiveKit. Tokens já emitidos podem ser reutilizados até sua expiração, por até 60 segundos; esse limite deve ser considerado antes de classificar a revogação como instantânea.
- Sem catálogo público de salas. Criação exige chave do anfitrião. Requisições verificam origem, formato e limite de tamanho. Limites de tentativa ficam no D1, usando hash do IP e janela de tempo. Em hospedagem diferente, o cabeçalho de IP precisa vir de proxy confiável.
- O backend e o LiveKit ainda processam metadados como nome, sala, endereço de rede e horários; esses metadados não são E2EE. Não há funcionalidade de gravação, mas participantes podem gravar por outros meios.
- Um participante malicioso pode publicar várias telas; a lista é protegida pelas permissões e limites gerais do LiveKit. O anfitrião pode encerrar a sala inteira. Moderação individual e contas persistentes não fazem parte desta versão.

## Verificação e pendências

Os testes unitários usam SQLite real para a persistência e mock do serviço de mídia; o teste adicional de transmissão usa o serviço LiveKit real. Verificam convites, acesso entre salas, permissões dos JWT reais, expiração, revogação, falha do provedor e limites. Não substituem uma chamada real.

Verificação de transmissão realizada em 06/09/2026: três participantes WebRTC reais conectados ao LiveKit Cloud, com áudio sintético bidirecional e vídeo sintético 1920×1080. O receptor decodificou 623 quadros a aproximadamente 57,6 fps. Um participante com a chave errada não decodificou áudio nem vídeo. Encerramento desconectou todos, e o convite revogado retornou 403. Esses testes exercitam a transmissão real sem capturar microfone ou tela do usuário; o resultado não garante a mesma taxa em todos os computadores ou redes.

A ferramenta WebMCP `open_call_settings` abre somente as configurações. Não liga microfone nem tela. O ambiente de entrega não ofereceu um contexto WebMCP para validar sua execução; não houve verificação em navegador.

Referências: [criptografia LiveKit](https://docs.livekit.io/transport/encryption/), [tokens e permissões](https://docs.livekit.io/frontends/reference/tokens-grants/), [opções de mídia](https://docs.livekit.io/transport/media/advanced/).
