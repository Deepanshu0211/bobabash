import {Window} from './ui';

const SPONSORS = [
  {name: 'Hack Club', href: 'https://hackclub.com', blurb: 'A global community of teen hackers and makers.', logo: <img src="/assets/hack-club.png" alt="Hack Club" width="148" height="68"/>},
  {name: '.xyz', href: 'https://gen.xyz', blurb: 'The domain for the next generation of builders.', logo: <span className="xyz-mark" aria-label=".xyz">.xyz</span>}
];

export function Sponsors() {
  return (
    <Window title="sponsors.zip" className="sponsor-window">
      <h2>thank you to our supporters!</h2>
      <ul className="sponsor-list">
        {SPONSORS.map(s => (
          <li key={s.name}>
            <a href={s.href} target="_blank" rel="noreferrer noopener" className="sponsor-card">
              <span className="sponsor-logo">{s.logo}</span>
              <strong>{s.name}</strong>
              <small>{s.blurb}</small>
            </a>
          </li>
        ))}
      </ul>
    </Window>
  );
}
