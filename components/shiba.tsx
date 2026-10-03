export function Shiba({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`shiba ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <g className="shiba-tail">
        <path d="M48 38h8V26h-8v4h4v4h-8" fill="#d8944c" />
        <path d="M52 26h4v12h-8v-4h4" fill="#f5d4a1" />
      </g>
      <path d="M16 38h32v12h-4v8h-8v-8H24v8h-8V38Z" fill="#d8944c" />
      <path d="M24 42h16v8H24z" fill="#f5e6c9" />
      <g className="shiba-head">
        <path
          d="M12 10h8v4h4v4h16v-4h4v-4h8v28h-4v8H16v-8h-4V10Z"
          fill="#e9ad66"
        />
        <path d="M16 14h4v8h-4zM44 14h4v8h-4z" fill="#925638" />
        <path d="M12 30h8v4h8v4h8v-4h8v-4h8v8h-4v8H16v-8h-4z" fill="#f5e6c9" />
        <g className="shiba-eyes" fill="#211b18">
          <path d="M20 26h4v4h-4zM40 26h4v4h-4z" />
        </g>
        <path d="M28 34h8v4h-8zM30 38h4v4h-4z" fill="#211b18" />
        <path d="M30 42h4v4h-4z" fill="#d97672" />
      </g>
    </svg>
  );
}
