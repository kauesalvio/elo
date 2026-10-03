import { Gauge, ExternalLink } from 'lucide-react';

export function LivekitLimits({ participants }: { participants: number }) {
  return (
    <section className="limits-panel" aria-labelledby="limits-title">
      <div className="limits-heading">
        <h2 id="limits-title">
          <Gauge size={17} aria-hidden="true" /> LiveKit / plano gratuito
        </h2>
        <a
          href="https://docs.livekit.io/deploy/admin/quotas-and-limits/"
          target="_blank"
          rel="noreferrer"
        >
          Ver limites <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only">, abre em nova aba</span>
        </a>
      </div>
      <dl className="limits-grid">
        <div>
          <dt>Minutos de participante / mês</dt>
          <dd>
            5.000 <small>min</small>
          </dd>
        </div>
        <div>
          <dt>Transferência de saída / mês</dt>
          <dd>
            50 <small>GB</small>
          </dd>
        </div>
        <div>
          <dt>Conexões simultâneas / projeto</dt>
          <dd>
            100 <small>pessoas</small>
          </dd>
        </div>
      </dl>
      <p>
        {participants > 0
          ? `${participants} ${participants === 1 ? 'pessoa nesta sala consome 1 minuto' : `pessoas nesta sala consomem ${participants} minutos`} da cota a cada minuto conectado. `
          : 'Cada pessoa conectada consome 1 minuto da cota por minuto. '}
        As cotas são compartilhadas entre os projetos gratuitos da conta e
        renovam no dia 1. Ao esgotar, novas conexões podem falhar.
      </p>
      <div className="limits-foot">
        <span>Esta sala aceita até 12 pessoas.</span>
        <span>Cotas do plano. O saldo real fica no painel LiveKit.</span>
      </div>
    </section>
  );
}
