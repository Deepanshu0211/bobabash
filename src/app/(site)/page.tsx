import Link from 'next/link';
import {formatEventDay, getEvent, getHighlights} from '@/lib/portal';
import {PHASES, phaseIndex} from '@/lib/rules.mjs';
import {Window} from '@/components/ui';
import {SITE, siteUrl} from '@/lib/site';
import {Draggable} from '@/components/draggable';
import {FAQ} from '@/components/faq';
import {Winners} from '@/components/winners';
import {Sponsors} from '@/components/sponsors';

// [left %, size px, delay s, duration s] for the pearls drifting up behind the hero.
const PEARLS = [[6, 14, 0, 14], [14, 9, 3, 11], [27, 18, 6, 17], [41, 11, 1, 13], [58, 15, 8, 16], [72, 10, 4, 12], [84, 20, 2, 18], [93, 12, 7, 14]];
const TICKER = ['build something small', 'get reviewed by volunteers', 'vote for three', 'drink boba', 'meet your people'];

export default async function Home() {
  const [event, highlights] = await Promise.all([getEvent(), getHighlights()]);
  const phase = PHASES[phaseIndex(event?.phase ?? 'setup')];
  const day = formatEventDay(event);
  const published = event?.phase === 'results_published';
  // schema.org Event so search engines can show the date and venue.
  const eventLd = {
    '@context': 'https://schema.org', '@type': 'Event', name: SITE.name, description: SITE.description,
    ...(event?.starts_at && {startDate: event.starts_at.slice(0, 10)}),
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {'@type': 'Place', name: event?.venue_name ?? 'Chandigarh University, Lucknow', address: event?.venue_address ?? 'Lucknow, Uttar Pradesh'},
    organizer: {'@type': 'Organization', name: 'Hack Club', url: 'https://hackclub.com'},
    image: new URL('/opengraph-image.png', siteUrl()).toString(), url: siteUrl().toString(), isAccessibleForFree: true
  };
  return (
    <div className="landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(eventLd).replace(/</g, '\\u003c')}}/>
      <section className="hero">
        <div className="hero-grid"/>
        <div className="pearl-field" aria-hidden="true">
          {PEARLS.map(([x, size, delay, duration], i) => <i key={i} style={{'--x': x + '%', '--size': size + 'px', '--delay': delay + 's', '--dur': duration + 's'} as React.CSSProperties}/>)}
        </div>
        <div className="hero-stage">
          <Draggable>
          <Window title="what your event could look like…" className="hero-rear" tone="yellow" draggable>
            <div className="collage" aria-label="A little taste of Boba Bash">
              <div className="collage-one"><img src="/assets/step-build.png" alt="A raccoon building a project" data-parallax="-0.05"/></div>
              <div className="collage-note">a little code,<br/></div>
              <div className="collage-drink"><img src="/assets/drink.png" alt="Illustrated bubble tea" className="float"/></div>
              <div className="collage-friends"><img src="/assets/step-boba.png" alt="Friends sharing projects and boba" data-parallax="-0.05"/></div>
              <div className="collage-bottom">your next favourite memory.exe</div>
            </div>
          </Window>
          </Draggable>
          <Draggable>
          <div className="hero-front">
            <div className="window-bar front-bar" data-drag-handle tabIndex={0} title="Drag to move. Double-click to reset." aria-label="boba_bash.exe window. Drag or use arrow keys to move.">
              <span className="window-title">boba_bash.exe</span>
              <span aria-hidden="true" className="window-controls">– □ <b>×</b></span>
            </div>
            <img className="hero-logo" src="/assets/logo.png" alt="Boba Bash" width="510" height="330" fetchPriority="high"/>
            <div className="hero-copy">
              <h1>make a website, hang out with friends,<br/><span>get free boba!</span></h1>
              <p className="hero-meta"><span className="live-dot" aria-hidden="true"/>{day ?? 'date coming soon'}{event?.venue_name ? ` · ${event.venue_name}` : ''}</p>
              <p className="hero-phase">{phase.label.toLowerCase()}</p>
              <div className="hero-rule"/>
              <div className="hero-signup">
                <Link className="hero-cta" href="/login">enter the portal ↗</Link>
                <Link className="hero-cta ghost" href="/event-rules">how voting works</Link>
              </div>
            </div>
          </div>
          </Draggable>
        </div>
      </section>

      {published && <Winners highlights={highlights} published/>}

      {/* <div className="ticker" aria-hidden="true">
        <div>{[0, 1].map(k => <span key={k}>{TICKER.map(t => <b key={t}>{t}<i>✦</i></b>)}</span>)}</div>
      </div> */}

      <section id="about" className="about-section">
        <div className="content">
          <div className="about-heading" data-reveal>
            <h2><img src="/assets/about-heading.png" alt="What is a Boba Bash?"/></h2>
            <img src="/assets/drink.png" alt="" className="little-drink float"/>
          </div>
          <div className="about-layout">
            <figure className="attachment" data-reveal>
              <div><img src="/assets/step-boba.png" alt="A raccoon, a ghost and a bunny sharing their creations" data-parallax="-0.08"/></div>
             
            </figure>
            <div className="message-bubble" data-reveal>
              <p className="eyebrow">new message from: the boba bash crew</p>
              <h3>Big ideas. Small projects.<br/>Really good company.</h3>
              <p>A little get-together for people who like making things. Bring an idea, build something that feels like you.</p>
              <p>One day. Build, get reviewed, vote for your favourites.</p>
              <p className="message-signoff">let&apos;s make something cool together :)</p>
            </div>
          </div>
        </div>
      </section>

      <section className="process-section">
        <img className="paper-top" src="/assets/paper-top.png" alt=""/>
        <div className="content">
          <h2 className="speech-heading" data-reveal>What do you do at a Boba Bash?</h2>
          <div className="process-grid" data-stagger>
            {[
              {image: 'step-signup', title: 'build', text: 'Make one project. Submit a demo and a repo.'},
              {image: 'step-build', title: 'get reviewed', text: 'Three volunteers check it. Majority makes the shortlist.'},
              {image: 'step-boba', title: 'vote & boba!', text: 'Pick your three favourites. Then celebrate together.'}
            ].map((step, i) => (
              <article className="process-card" key={step.title}>
                <span className="step-number">0{i + 1}</span>
                <img src={`/assets/${step.image}.png`} alt={step.title + ' mascot illustration'} loading="lazy"/>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
        <img className="paper-bottom" src="/assets/paper-bottom.png" alt=""/>
      </section>

      {!published && <Winners highlights={highlights} published={false}/>}

      <section className="event-section">
        <div className="content">
          <div className="event-layout">
            <Window title="the venue!" className="venue-window">
              <div className="venue-art">
                <img src="/assets/globe.png" alt="" data-parallax="0.12"/>
                <div>
                  <span className="eyebrow">offline friends. online ideas.</span>
                  <h2>{event?.venue_name || 'A place to make your next thing.'}</h2>
                  <p>{event?.venue_address || 'Venue details are on their way.'}</p>
                </div>
                <img src="/assets/drink.png" alt="" className="venue-boba"/>
              </div>
            </Window>
            <article className="event-note" data-reveal>
              <h2>event info</h2>
              <dl>
                <dt>when:</dt><dd>{day ?? 'to be announced'}</dd>
                <dt>where:</dt><dd>{event?.venue_name ?? 'to be announced'}</dd>
                <dt>schedule:</dt><dd>announced on the day</dd>
                <dt>boba:</dt><dd>yes, please!</dd>
              </dl>
              <Link className="button coral-button" href="/login">open the portal ››</Link>
            </article>
          </div>
          {event?.announcement && <p className="announcement" data-reveal>{event.announcement}</p>}
          <Sponsors/>
        </div>
      </section>

      <section id="faq" className="faq-section">
        <div className="faq-heading" data-reveal><h2>FAQ</h2><p>frequently asked<br/>questions</p></div>
        <Window title="faq.csv" className="faq-window">
          <FAQ/>
          <p className="faq-footnote">still curious? your local organizers are happy to help.</p>
        </Window>
      </section>
    </div>
  );
}
