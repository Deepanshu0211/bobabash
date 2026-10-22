import {BobaLoader} from '@/components/loader';

export default function PortalLoading() {
  return (
    <div className="portal-loading">
      <BobaLoader label="brewing the latest data"/>
      <div className="skeleton-grid" aria-hidden="true">{[0, 1, 2].map(i => <div key={i} className="skeleton sk-card"/>)}</div>
    </div>
  );
}
