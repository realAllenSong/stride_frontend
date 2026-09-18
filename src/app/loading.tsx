export default function Loading() {
  return (
    <main className="boot-screen" aria-busy="true">
      <div className="boot-wordmark">STRIDE</div>
      <p>Loading this snapshot…</p>
      <div className="skeleton wide" />
      <div className="skeleton block" />
    </main>
  );
}
