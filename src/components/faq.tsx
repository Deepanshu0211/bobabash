'use client';
import {useId,useRef,useState} from 'react';
import gsap from 'gsap';
export const questions=[
 ['Who can take part?','Registered participants on the event roster. Sign in with your registered email and we send a one-time link.'],
 ['How long is it?','One day. The build, the reviews and the vote all happen on event day. Organizers announce each stage as it opens.'],
 ['What should I make?','A website, game, tool, art piece or hardware hack. Small and finished beats big and broken.'],
 ['How do I submit?','Open the portal, go to My submission, add a demo link and a repository link, then submit before the deadline.'],
 ['Who picks the shortlist?','Volunteers. Three of them review each project, and a majority decides.'],
 ['How do votes work?','Pick three shortlisted projects you love. Not your own. One ballot, final once sent.'],
 ['Can I see the leaderboard?','Not during voting. Results appear once organizers publish them.'],
 ['Any special awards?','Yes. A Creative Award and a Best GitHub Award, judged by organizers.']
];
function Item({question,answer}:{question:string;answer:string}){
 const [open,setOpen]=useState(false);const id=useId();const panel=useRef<HTMLDivElement>(null);
 function toggle(){const next=!open;setOpen(next);if(panel.current){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){panel.current.style.height=next?'auto':'0px';return;}gsap.to(panel.current,{height:next?'auto':0,duration:.25,overwrite:true,ease:'power2.out'});}}
 return <div className="faq-item"><h3><button aria-expanded={open} aria-controls={id} onClick={toggle}>{question}<span aria-hidden="true">{open?'−':'+'}</span></button></h3><div id={id} ref={panel} className="faq-answer" inert={!open}><p>{answer}</p></div></div>;
}
export function FAQ(){return <div className="faq-grid">{questions.map(([q,a])=><Item key={q} question={q} answer={a}/>)}</div>;}
