export default function Carregando({ texto = 'Carregando…' }) {
  return (
    <main className="centro" role="status" aria-live="polite">
      <div className="giro" aria-hidden="true" />
      <p>{texto}</p>
    </main>
  );
}
