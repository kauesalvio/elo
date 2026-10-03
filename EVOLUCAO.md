# Evolução do rapaziadahora

Preparação do repositório em 02/10/2026: 19 testes e TypeScript passaram com Node 26.4.0; o build passou com Node 24.19.0. O primeiro build com Node 26 gerou os arquivos, mas encerrou com falha nativa no Windows. A esteira usa Node 22 em Linux e ainda precisa ser executada no GitHub. O lint encontrou pendências existentes e permanece informativo.

O código deste repositório foi recuperado da entrega original de setembro de 2026, preservando seus quatro commits. O aplicativo publicado está em https://rapaziadahora.online e sua hospedagem é no Sites. O LiveKit Cloud fornece a transmissão de tela e áudio da tela; o banco do aplicativo usa D1.

## Fluxo de mudanças

1. Crie uma branch para a mudança: `git switch -c minha-melhoria`.
2. Faça a alteração e execute `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
3. Faça commit, envie a branch ao GitHub e abra um pull request.
4. Confira a execução **Validação** na aba Actions e revise o diff antes de integrar em `main`.
5. Publique a versão aprovada pelo fluxo do Sites. Confira compartilhamento de tela, áudio da tela, convite, cotas visíveis e encerramento da sala após publicar.

O workflow roda em pushes para `main`, pull requests e execução manual. Tipos, testes e build são obrigatórios. O lint é informativo nesta primeira versão, pois a checagem do código original encontrou erros existentes nos componentes e no aplicativo; eles continuam visíveis no log. Corrija essas pendências e remova `continue-on-error` para torná-lo obrigatório. Os testes usam dados fictícios e mock do serviço de mídia: não precisam das credenciais de produção. A esteira não publica automaticamente no Sites. Integrar em `main` registra uma versão do código, mas não altera o site em produção.

## Atualizações de dependências

O Dependabot está configurado para propor atualizações semanais de npm e GitHub Actions por pull request. Atualizações minor e patch de npm são agrupadas; atualizações major ficam separadas. Revise as mudanças e os resultados da validação antes de integrar. Não há aprovação ou merge automático.

Após criar o repositório no GitHub, configure uma regra de proteção para `main`, exigindo pull request e a verificação **Tipos, testes e build**, se esse recurso estiver disponível para a conta. A configuração versionada neste projeto não ativa essa proteção por si só.

## Configuração local e publicação

Use Node 22 atualizado e `npm ci` para instalar as versões do lockfile. Copie `.env.example` para `.env` e preencha as credenciais localmente, seguindo o README. Nunca versione `.env`, a chave de anfitrião ou credenciais do LiveKit. A cópia recuperada não contém os segredos do ambiente original.

O arquivo `.openai/hosting.json` identifica o projeto Sites existente. As migrations versionadas em `drizzle/` são aplicadas pelo fluxo de publicação do Sites; mudanças no banco precisam ser revisadas junto com o código. Segredos continuam configurados no runtime da hospedagem.

Para reversão de uma publicação, use a versão anterior no Sites e verifique a compatibilidade do banco: reverter código não desfaz migrations automaticamente.
