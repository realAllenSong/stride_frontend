"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="boot-screen">
      <div className="boot-wordmark">STRIDE</div>
      <h1>This snapshot could not be loaded.</h1>
      <p>Your source records have not been changed.</p>
      <button className="button primary" onClick={reset}>
        Reload snapshot
      </button>
    </main>
  );
}
