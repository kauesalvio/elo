# rapaziadahora

Salas privadas para compartilhar a tela com até 12 pessoas. A mídia usa criptografia ponta a ponta. O app não transmite câmera nem microfone.

## Usar o app

1. Acesse [rapaziadahora.online](https://rapaziadahora.online).
2. Para criar uma sala, informe seu apelido, o nome da sala e a senha do anfitrião.
3. Envie o convite às pessoas que vão participar.
4. Os convidados abrem o link e escolhem um apelido. O anfitrião escolhe a tela no navegador.

Use uma versão atual do Chrome ou Edge em um computador. O áudio da aba depende do navegador.

## Rodar localmente

Requer Node.js 22.13 ou 24.

```sh
npm ci
cp .env.example .env
npm run db:local
npm run dev
```

Preencha `.env` com `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `RAPAZIADAHORA_HOST_PASSWORD` e `ELO_HOST_KEY`.

- `RAPAZIADAHORA_HOST_PASSWORD`: senha para criar salas, com pelo menos 10 caracteres.
- `ELO_HOST_KEY`: valor aleatório com pelo menos 32 caracteres para assinar a sessão do anfitrião.

## Verificar alterações

```sh
npm run typecheck
npm test
npm run build
```

## Publicar

O OpenAI Sites publica o app. O arquivo `.openai/hosting.json` identifica o projeto. As migrations do D1 ficam em `drizzle/`. Não altere uma migration já publicada.

Compartilhe o convite apenas com quem deve entrar. Convites expiram em 24 horas. A chave de mídia fica no fragmento do link e não é enviada ao backend.
