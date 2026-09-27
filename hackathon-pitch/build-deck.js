const pptxgen = require('pptxgenjs');
const path = require('path');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Proof of Rent';
pptx.subject = 'Hackathon pitch — renter trust and deposit escrow in Poland';
pptx.title = 'Proof of Rent — Your rent history. Your proof.';
pptx.company = 'Proof of Rent';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US'
};
pptx.defineSlideMaster({
  title: 'POR',
  background: { color: 'F6F6F3' },
  objects: [
    { line: { x: 0.6, y: 7.12, w: 12.13, h: 0, line: { color: 'E2E2DC', width: 0.7 } } },
    { text: { text: 'PROOF OF RENT', options: { x: 0.62, y: 7.18, w: 2.1, h: 0.17, fontFace: 'Aptos', fontSize: 7.5, bold: true, color: '5C5C57', charSpacing: 1.8, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.16, w: 0.6, h: 0.2, color: '5C5C57', fontFace: 'Aptos', fontSize: 8, align: 'right', margin: 0 }
});
pptx.defineLayout({ name: 'CUSTOM_WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'CUSTOM_WIDE';

const C = { bg:'F6F6F3', ink:'111111', orange:'FF4A1C', orangeInk:'C2330C', muted:'5C5C57', border:'E2E2DC', card:'FFFFFF', cream:'ECECE7', green:'167A51', red:'B0103C' };
const out = path.join(__dirname, 'Proof-of-Rent-Hackathon-Pitch.pptx');

function tx(slide, text, x, y, w, h, size=22, color=C.ink, opts={}) {
  slide.addText(text, { x,y,w,h, fontFace: opts.fontFace || 'Aptos', fontSize:size, color, bold:!!opts.bold, margin:0, breakLine: false,
    valign: opts.valign || 'mid', align: opts.align || 'left', fit:'shrink', paraSpaceAfterPt:0, charSpacing: opts.charSpacing || 0,
    isTextBox:true, bullet:opts.bullet, italic:!!opts.italic, transparency: opts.transparency || 0 });
}
function rect(slide,x,y,w,h,fill=C.card,line=C.border,r=0.08) {
  slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:r,fill:{color:fill},line:{color:line,width:0.8},radius:r});
}
function line(slide,x,y,w,h,color=C.border,width=1,dash='solid') { slide.addShape(pptx.ShapeType.line,{x,y,w,h,line:{color,width,dashType:dash,beginArrowType:'none',endArrowType:'none'}}); }
function label(slide,text,x,y,w=3) { tx(slide,text.toUpperCase(),x,y,w,0.22,9,C.orangeInk,{bold:true,charSpacing:1.5}); }
function title(slide, text, y=0.78, w=11.8) { tx(slide,text,0.62,y,w,0.86,34,C.ink,{bold:true}); }
function pill(slide,text,x,y,w,fill=C.card,color=C.muted) { rect(slide,x,y,w,0.34,fill,C.border,0.16); tx(slide,text,x+0.12,y+0.01,w-0.24,0.31,9,color,{bold:true,align:'center'}); }
function logo(slide,x=0.62,y=0.5,scale=1) {
  const s=0.46*scale;
  slide.addShape(pptx.ShapeType.roundRect,{x,y,w:s,h:s,rectRadius:0.08,fill:{color:C.orange},line:{color:C.orange},radius:0.08});
  // simplified document + verification glyph
  slide.addShape(pptx.ShapeType.rect,{x:x+s*0.27,y:y+s*0.18,w:s*0.34,h:s*0.46,fill:{color:C.orange,transparency:100},line:{color:C.ink,width:1.2}});
  line(slide,x+s*0.34,y+s*0.36,s*0.19,0,C.ink,1);
  slide.addShape(pptx.ShapeType.ellipse,{x:x+s*0.49,y:y+s*0.49,w:s*0.28,h:s*0.28,fill:{color:C.orange},line:{color:C.ink,width:1.2}});
  line(slide,x+s*0.55,y+s*0.63,s*0.055,s*0.055,C.ink,1.1);
  line(slide,x+s*0.605,y+s*0.685,s*0.10,-s*0.13,C.ink,1.1);
  tx(slide,'Proof of Rent',x+s+0.15,y,2.4,s,16,C.ink,{bold:true});
}
function note(slide, text) { slide.addNotes(text); }
function rosette(slide,cx,cy,r,opacity=70) {
  const count=18;
  for(let i=0;i<count;i++){
    const a=2*Math.PI*i/count;
    const x=cx+Math.cos(a)*r*0.34-r*0.22;
    const y=cy+Math.sin(a)*r*0.34-r*0.22;
    slide.addShape(pptx.ShapeType.ellipse,{x,y,w:r*0.44,h:r*0.44,rotate:i*20,fill:{color:C.bg,transparency:100},line:{color:C.orange,width:0.7,transparency:opacity}});
  }
  slide.addShape(pptx.ShapeType.ellipse,{x:cx-r*0.21,y:cy-r*0.21,w:r*0.42,h:r*0.42,fill:{color:C.bg,transparency:100},line:{color:C.orange,width:1,transparency:opacity}});
}
function arrow(slide,x,y,w,color=C.orange) { slide.addShape(pptx.ShapeType.line,{x,y,w,h:0,line:{color,width:2.4,beginArrowType:'none',endArrowType:'triangle'}}); }

// 1 — Cover
{
 const s=pptx.addSlide('POR');
 logo(s,0.62,0.48,1.05);
 label(s,'Hackathon pitch · Poland',0.65,1.52,3.4);
 tx(s,'Your rent history.\nYour proof.',0.62,1.78,7.4,2.15,48,C.ink,{bold:true});
 tx(s,'A protected deposit that becomes a portable trust passport.',0.66,4.22,6.1,0.72,20,C.muted,{});
 pill(s,'ESCROW',0.66,5.36,1.28,C.card,C.ink); pill(s,'TRUST',2.08,5.36,1.15,C.card,C.ink); pill(s,'ON-CHAIN',3.37,5.36,1.42,C.card,C.ink);
 rosette(s,10.55,3.18,4.3,55);
 rect(s,8.75,2.13,3.28,2.18,C.card,C.border,0.12);
 tx(s,'TENANT PASSPORT',9.06,2.43,2.1,0.24,10,C.muted,{bold:true,charSpacing:1.2});
 tx(s,'2 of 2',9.05,2.86,1.8,0.56,28,C.orangeInk,{bold:true});
 tx(s,'deposits returned in full',9.06,3.39,2.34,0.42,13,C.ink,{});
 s.addShape(pptx.ShapeType.ellipse,{x:11.08,y:2.75,w:0.55,h:0.55,fill:{color:C.orange},line:{color:C.orange}});
 tx(s,'✓',11.08,2.75,0.55,0.55,20,C.ink,{bold:true,align:'center'});
 note(s,`0:00–0:20\nForeign renters arrive in Poland with income, references and a rental history — but none of it travels with them. Proof of Rent turns every completed lease into proof the next landlord can trust.`);
}

// 2 — Problem
{
 const s=pptx.addSlide('POR');
 label(s,'The problem',0.62,0.48,2.4);
 title(s,'For foreign renters, “new country” often means “no trust.”',0.78,11.9);
 const cards=[
  {x:0.65,n:'01',h:'Rejected',d:'No Polish rental or credit history',icon:'×'},
  {x:4.48,n:'02',h:'Double deposit',d:'Risk is priced into the kaucja',icon:'2×'},
  {x:8.31,n:'03',h:'Proof ignored',d:'Foreign bank statements are unreadable or unverifiable',icon:'?'},
 ];
 cards.forEach(c=>{rect(s,c.x,2.16,3.52,3.43,C.card,C.border,0.1); tx(s,c.n,c.x+0.28,2.43,0.6,0.25,10,C.orangeInk,{bold:true,charSpacing:1.5}); tx(s,c.icon,c.x+2.58,2.38,0.58,0.63,26,C.orangeInk,{bold:true,align:'center'}); tx(s,c.h,c.x+0.28,3.25,2.85,0.52,23,C.ink,{bold:true}); tx(s,c.d,c.x+0.28,4.03,2.88,0.88,15,C.muted,{});});
 tx(s,'Trust resets at the border.',0.65,6.16,7.4,0.55,25,C.ink,{bold:true});
 line(s,8.23,6.44,3.72,0,C.orange,2.2);
 note(s,`0:20–0:48\nIn Poland, foreigners are often rejected outright or asked for a deposit twice as high. A Ukrainian bank statement may be genuine, but the landlord cannot read or verify it. And a PDF says nothing about how the previous lease ended.`);
}

// 3 — Two-sided pain
{
 const s=pptx.addSlide('POR');
 label(s,'A broken trust loop',0.62,0.48,3);
 title(s,'The deposit protects the landlord — until it traps the tenant.',0.78,11.7);
 rect(s,0.65,2.18,5.28,3.56,C.card,C.border,0.1);
 rect(s,7.4,2.18,5.28,3.56,C.card,C.border,0.1);
 tx(s,'LANDLORD',0.98,2.52,2.1,0.28,10,C.orangeInk,{bold:true,charSpacing:1.6});
 tx(s,'“I don’t know\nif I can trust you.”',0.98,3.03,4.25,1.18,27,C.ink,{bold:true});
 tx(s,'→ higher deposit\n→ more rejection',0.98,4.56,3.6,0.72,16,C.muted,{});
 tx(s,'TENANT',7.73,2.52,2.1,0.28,10,C.orangeInk,{bold:true,charSpacing:1.6});
 tx(s,'“How do I get\nmy deposit back?”',7.73,3.03,4.25,1.18,27,C.ink,{bold:true});
 tx(s,'→ weak leverage\n→ court is slow and expensive',7.73,4.56,4.15,0.72,16,C.muted,{});
 arrow(s,5.98,3.83,1.35,C.orange); arrow(s,7.35,4.30,-1.35,C.orange);
 tx(s,'The platform must not become another party users have to trust.',1.3,6.24,10.7,0.45,20,C.ink,{bold:true,align:'center'});
 note(s,`0:48–1:14\nBoth sides lose. The landlord lacks a reliable signal. The tenant hands over the money and then has very little leverage if it is withheld. Going to court across a language and legal barrier is rarely realistic.`);
}

// 4 — Solution
{
 const s=pptx.addSlide('POR');
 label(s,'The solution',0.62,0.48,2.4);
 title(s,'One deposit. Two protections. A record that travels.',0.78,11.6);
 const xs=[0.72,4.65,8.58];
 const items=[
  ['01','LOCK','Deposit enters a smart-contract escrow'],
  ['02','SETTLE','Returned, split, or resolved by an arbiter'],
  ['03','PROVE','Outcome becomes a portable rent passport'],
 ];
 items.forEach((it,i)=>{rect(s,xs[i],2.28,3.38,3.32,i===1?C.cream:C.card,C.border,0.1); tx(s,it[0],xs[i]+0.26,2.54,0.42,0.25,10,C.orangeInk,{bold:true,charSpacing:1.4}); tx(s,it[1],xs[i]+0.26,3.14,2.6,0.38,22,C.ink,{bold:true,charSpacing:1}); tx(s,it[2],xs[i]+0.26,3.86,2.82,0.92,15,C.muted,{}); if(i<2) arrow(s,xs[i]+3.48,3.94,0.42,C.orange);});
 tx(s,'No custody by us. No editable PDF. No private banking documents.',0.75,6.16,11.65,0.5,21,C.ink,{bold:true,align:'center'});
 note(s,`1:14–1:46\nProof of Rent puts only the security deposit into escrow. When the lease ends, the money is returned, split by agreement, or resolved by an arbiter. That verified outcome becomes a portable rent passport.`);
}

// 5 — Passport
{
 const s=pptx.addSlide('POR');
 label(s,'The trust passport',0.62,0.48,3.1);
 title(s,'A universal signal — without exposing private documents.',0.78,11.8);
 rect(s,0.67,2.03,7.15,3.98,C.card,C.border,0.1);
 tx(s,'TENANT PASSPORT',1.05,2.39,2.4,0.25,10,C.muted,{bold:true,charSpacing:1.5});
 tx(s,'Verified renter',1.05,2.81,3.7,0.48,24,C.ink,{bold:true});
 tx(s,'Publicly verifiable on Solana',1.05,3.31,3.5,0.3,12,C.muted,{});
 const facts=[['2 of 2','Deposit back in full'],['2','Completed leases'],['18','Months on record']];
 facts.forEach((f,i)=>{ const x=1.05+i*2.14; if(i) line(s,x-0.25,4.07,0,1.04,C.border,0.8); tx(s,f[0],x,4.05,1.7,0.54,26,i===0?C.orangeInk:C.ink,{bold:true}); tx(s,f[1],x,4.68,1.68,0.54,11,C.muted,{});});
 // verification seal
 s.addShape(pptx.ShapeType.ellipse,{x:6.38,y:2.61,w:0.86,h:0.86,fill:{color:C.orange},line:{color:C.orange}}); tx(s,'✓',6.38,2.62,0.86,0.82,27,C.ink,{bold:true,align:'center'});
 const right=[['IMMUTABLE','The outcome cannot be rewritten'],['PORTABLE','Works across landlords and borders'],['PRIVATE BY DESIGN','Public summary, no bank statement']];
 right.forEach((r,i)=>{const y=2.08+i*1.33; tx(s,r[0],8.45,y,3.55,0.28,11,C.orangeInk,{bold:true,charSpacing:1.2}); tx(s,r[1],8.45,y+0.37,3.85,0.52,15,C.ink,{}); if(i<2) line(s,8.45,y+1.08,3.75,0,C.border,0.8);});
 note(s,`1:46–2:15\nThe passport does not publish salary, rent or exact deposit amounts. It shows the signal a landlord actually needs: completed leases, payment history, and whether deposits were returned. The record cannot be silently edited and can be verified without our API.`);
}

// 6 — Why blockchain + demo
{
 const s=pptx.addSlide('POR');
 label(s,'Why blockchain',0.62,0.48,2.8);
 title(s,'The blockchain is the neutral third party.',0.78,10.5);
 const rows=[
  ['ESCROW','Funds follow contract rules — not platform discretion.'],
  ['EVIDENCE','Lease outcomes are independently verifiable.'],
  ['CONTINUITY','The passport survives any company or database.'],
 ];
 rows.forEach((r,i)=>{const y=2.05+i*1.18; tx(s,'0'+(i+1),0.72,y,0.48,0.32,10,C.orangeInk,{bold:true,charSpacing:1.2}); tx(s,r[0],1.33,y,2.0,0.35,16,C.ink,{bold:true}); tx(s,r[1],3.2,y,5.2,0.5,15,C.muted,{}); line(s,0.72,y+0.78,7.6,0,C.border,0.8);});
 rect(s,8.8,1.79,3.83,3.93,C.ink,C.ink,0.1);
 tx(s,'LIVE MVP',9.13,2.14,2.2,0.26,10,C.orange,{bold:true,charSpacing:1.6});
 tx(s,'Anchor + Solana',9.13,2.68,3.0,0.52,23,'FFFFFF',{bold:true});
 tx(s,'• smart-contract deposit escrow\n• tenant + landlord flow\n• settlement / dispute path\n• public rent passport',9.13,3.47,3.0,1.46,14,'D5D5CF',{});
 pill(s,'DEVNET',9.14,5.09,1.15,'242421','FFFFFF');
 tx(s,'Bank statements prove payments.\nProof of Rent proves how the lease ended.',0.72,6.12,11.55,0.64,22,C.ink,{bold:true,align:'center'});
 note(s,`2:15–2:42\nBlockchain is not decoration here. It removes us as custodian, makes the outcome independently verifiable, and keeps the passport alive even if our company disappears. Our MVP runs on Solana devnet with an Anchor escrow, settlement and dispute flow.`);
}

// 7 — Close
{
 const s=pptx.addSlide('POR');
 rosette(s,10.3,3.32,4.35,62);
 label(s,'The outcome',0.62,0.58,2.2);
 tx(s,'Stop asking renters\nto start from zero.',0.62,1.12,8.2,1.55,41,C.ink,{bold:true});
 tx(s,'Protect the deposit today.\nBuild trust for the next lease.',0.65,3.18,6.4,1.12,25,C.orangeInk,{bold:true});
 rect(s,8.65,2.19,3.35,2.28,C.card,C.border,0.1);
 tx(s,'YOUR RENT HISTORY.',8.98,2.62,2.6,0.28,11,C.muted,{bold:true,charSpacing:1.2});
 tx(s,'Your proof.',8.97,3.08,2.6,0.55,29,C.ink,{bold:true});
 line(s,8.98,3.92,2.32,0,C.orange,2.1);
 tx(s,'Proof of Rent',0.65,5.25,3.2,0.5,24,C.ink,{bold:true});
 tx(s,'Built for renters in Poland.',0.66,5.78,3.6,0.34,14,C.muted,{});
 pill(s,'DEMO',10.72,5.62,1.05,C.orange,C.ink);
 note(s,`2:42–3:00\nWe stop asking foreign renters to start from zero every time they cross a border or change a flat. Proof of Rent protects the deposit today — and turns it into trust for the next lease. Your rent history. Your proof. [Open the live demo.]`);
}

pptx.writeFile({ fileName: out }).then(()=>console.log(out));
