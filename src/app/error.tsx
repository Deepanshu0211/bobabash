'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="page-shell"><div className="empty"><h1>This window needs a refresh.</h1><p>We couldn&apos;t load the latest data. Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></div></div>;}
