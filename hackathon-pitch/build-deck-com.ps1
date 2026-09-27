param(
  [string]$Out = "C:\Programming\SOL\proof-of-rent\hackathon-pitch\Proof-of-Rent-Hackathon-Pitch.pptx",
  [string]$RenderDir = "C:\Programming\SOL\proof-of-rent\hackathon-pitch\rendered"
)
$ErrorActionPreference = 'Stop'
$ppLayoutBlank = 12
$ppSaveAsOpenXMLPresentation = 24
$ppShapeRectangle = 1
$ppShapeRoundedRectangle = 5
$ppShapeOval = 9
$ppShapeLine = 9
$msoFalse = 0
$msoTrue = -1
$msoTextOrientationHorizontal = 1
$W = 960.0; $H = 540.0
$C = @{ bg=0xF3F6F6; ink=0x111111; orange=0x1C4AFF; orangeInk=0x0C33C2; muted=0x57575C; border=0xDCE2E2; card=0xFFFFFF; cream=0xE7ECEC; white=0xFFFFFF; dark=0x181818 }
# Office RGB is BGR when passed as integer. Convert RRGGBB string to integer.
function RGB([string]$hex) { [Convert]::ToInt32($hex.Substring(4,2)+$hex.Substring(2,2)+$hex.Substring(0,2),16) }
$COL = @{ bg=(RGB 'F6F6F3'); ink=(RGB '111111'); orange=(RGB 'FF4A1C'); orangeInk=(RGB 'C2330C'); muted=(RGB '5C5C57'); border=(RGB 'E2E2DC'); card=(RGB 'FFFFFF'); cream=(RGB 'ECECE7'); white=(RGB 'FFFFFF'); dark=(RGB '181818') }

function Add-Rect($s,$x,$y,$w,$h,$fill,$line=$null,$radius=$false) {
  $type = if($radius){$ppShapeRoundedRectangle}else{$ppShapeRectangle}
  $sh=$s.Shapes.AddShape($type,$x,$y,$w,$h); $sh.Fill.ForeColor.RGB=$fill; $sh.Fill.Solid();
  if($null -eq $line){$sh.Line.Visible=$msoFalse}else{$sh.Line.Visible=$msoTrue;$sh.Line.ForeColor.RGB=$line;$sh.Line.Weight=0.75}
  return $sh
}
function Add-Line($s,$x1,$y1,$x2,$y2,$color,$weight=1,$arrow=$false) {
  $sh=$s.Shapes.AddLine($x1,$y1,$x2,$y2);$sh.Line.ForeColor.RGB=[int]$color;$sh.Line.Weight=[single]$weight
  if($arrow){$sh.Line.EndArrowheadStyle=3}; return $sh
}
function Add-Text($s,[string]$text,$x,$y,$w,$h,$size,$color,$bold=$false,$align=1,$font='Aptos',$italic=$false) {
  $sh=$s.Shapes.AddTextbox($msoTextOrientationHorizontal,$x,$y,$w,$h)
  $sh.TextFrame.MarginLeft=0;$sh.TextFrame.MarginRight=0;$sh.TextFrame.MarginTop=0;$sh.TextFrame.MarginBottom=0
  $sh.TextFrame.AutoSize=0;$sh.TextFrame.WordWrap=$msoTrue
  $tr=$sh.TextFrame.TextRange;$tr.Text=$text;$tr.Font.Name=$font;$tr.Font.Size=[single]$size;$tr.Font.Color.RGB=[int]$color;$tr.Font.Bold=if($bold){$msoTrue}else{$msoFalse};$tr.Font.Italic=if($italic){$msoTrue}else{$msoFalse};$tr.ParagraphFormat.Alignment=$align
  # PowerPoint COM resets new text boxes to a one-line default height. Restore
  # the requested geometry after assigning text so multi-line copy is not clipped.
  $sh.Left=[single]$x;$sh.Top=[single]$y;$sh.Width=[single]$w;$sh.Height=[single]$h
  return $sh
}
function Add-Base($p,$num) {
  $s=$p.Slides.Add($p.Slides.Count+1,$ppLayoutBlank);$s.Background.Fill.ForeColor.RGB=$COL.bg;$s.Background.Fill.Solid()
  Add-Line $s 44 512 916 512 $COL.border 0.6 | Out-Null
  Add-Text $s 'PROOF OF RENT' 45 516 150 12 7.5 $COL.muted $true | Out-Null
  Add-Text $s ([string]$num) 875 516 40 12 8 $COL.muted $false 3 | Out-Null
  return $s
}
function Add-Label($s,$text,$x=45,$y=34,$w=240){ Add-Text $s $text.ToUpper() $x $y $w 18 9 $COL.orangeInk $true | Out-Null }
function Add-Title($s,$text,$y=57,$size=31,$w=860){ Add-Text $s $text 45 $y $w 70 $size $COL.ink $true | Out-Null }
function Add-Pill($s,$text,$x,$y,$w,$fill=$null,$color=$null){if($null -eq $fill){$fill=$COL.card};if($null -eq $color){$color=$COL.ink};Add-Rect $s $x $y $w 25 $fill $COL.border $true|Out-Null;Add-Text $s $text ($x+7) ($y+6) ($w-14) 12 8.5 $color $true 2|Out-Null}
function Add-Logo($s){Add-Rect $s 45 34 34 34 $COL.orange $null $true|Out-Null;Add-Text $s 'OK' 51 43 22 13 8 $COL.ink $true 2|Out-Null;Add-Text $s 'Proof of Rent' 89 40 150 22 15 $COL.ink $true|Out-Null}
function Add-Notes($s,$text){ try {$s.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text=$text} catch {} }

$app=New-Object -ComObject PowerPoint.Application
$app.Visible=$msoTrue
$p=$app.Presentations.Add()
$p.PageSetup.SlideWidth=$W;$p.PageSetup.SlideHeight=$H
try {
# 1
$s=Add-Base $p 1;Add-Logo $s;Add-Label $s 'Hackathon pitch · Poland' 47 108 250
Add-Text $s "Your rent history.`nYour proof." 45 133 530 140 43 $COL.ink $true|Out-Null
Add-Text $s 'A protected deposit that becomes a portable trust passport.' 47 302 480 50 19 $COL.muted|Out-Null
Add-Pill $s 'ESCROW' 48 386 88;Add-Pill $s 'TRUST' 146 386 78;Add-Pill $s 'ON-CHAIN' 234 386 98
Add-Rect $s 644 151 231 157 $COL.card $COL.border $true|Out-Null;Add-Text $s 'TENANT PASSPORT' 666 174 145 15 9 $COL.muted $true|Out-Null;Add-Text $s '2 of 2' 666 207 126 40 27 $COL.orangeInk $true|Out-Null;Add-Text $s 'deposits returned in full' 666 250 170 24 12 $COL.ink|Out-Null
$seal=$s.Shapes.AddShape($ppShapeOval,800,196,42,42);$seal.Fill.ForeColor.RGB=$COL.orange;$seal.Line.Visible=$msoFalse;Add-Text $s 'OK' 807 210 28 13 8 $COL.ink $true 2|Out-Null
Add-Notes $s '0:00–0:20 — Foreign renters arrive in Poland with income, references and a rental history — but none of it travels with them. Proof of Rent turns every completed lease into proof the next landlord can trust.'
# 2
$s=Add-Base $p 2;Add-Label $s 'The problem';Add-Title $s 'For foreign renters, “new country” often means “no trust.”' 57 29
$cards=@(@(47,'01','Rejected','No Polish rental or credit history','X'),@(348,'02','Double deposit','Risk is priced into the kaucja','2X'),@(649,'03','Proof ignored','Foreign bank statements are unreadable or unverifiable','?'))
foreach($c in $cards){Add-Rect $s $c[0] 160 264 246 $COL.card $COL.border $true|Out-Null;Add-Text $s $c[1] ($c[0]+20) 181 35 15 9 $COL.orangeInk $true|Out-Null;Add-Text $s $c[4] ($c[0]+192) 177 42 34 23 $COL.orangeInk $true 2|Out-Null;Add-Text $s $c[2] ($c[0]+20) 233 218 32 21 $COL.ink $true|Out-Null;Add-Text $s $c[3] ($c[0]+20) 291 216 62 14 $COL.muted|Out-Null}
Add-Text $s 'Trust resets at the border.' 47 443 420 32 23 $COL.ink $true|Out-Null;Add-Line $s 600 461 866 461 $COL.orange 2|Out-Null
Add-Notes $s '0:20–0:48 — In Poland, foreigners are often rejected outright or asked for a deposit twice as high. A Ukrainian bank statement may be genuine, but the landlord cannot read or verify it. And a PDF says nothing about how the previous lease ended.'
#3
$s=Add-Base $p 3;Add-Label $s 'A broken trust loop';Add-Title $s 'The deposit protects the landlord — until it traps the tenant.' 57 29
Add-Rect $s 47 158 380 254 $COL.card $COL.border $true|Out-Null;Add-Rect $s 533 158 380 254 $COL.card $COL.border $true|Out-Null
Add-Text $s 'LANDLORD' 70 184 130 16 9 $COL.orangeInk $true|Out-Null;Add-Text $s "“I don’t know`nif I can trust you.”" 70 224 310 72 24 $COL.ink $true|Out-Null;Add-Text $s "→ higher deposit`n→ more rejection" 70 326 270 49 14 $COL.muted|Out-Null
Add-Text $s 'TENANT' 556 184 130 16 9 $COL.orangeInk $true|Out-Null;Add-Text $s "“How do I get`nmy deposit back?”" 556 224 310 72 24 $COL.ink $true|Out-Null;Add-Text $s "→ weak leverage`n→ court is slow and expensive" 556 326 300 49 14 $COL.muted|Out-Null
Add-Line $s 437 276 520 276 $COL.orange 2 $true|Out-Null;Add-Line $s 520 314 437 314 $COL.orange 2 $true|Out-Null
Add-Text $s 'The platform must not become another party users have to trust.' 106 447 748 30 18 $COL.ink $true 2|Out-Null
Add-Notes $s '0:48–1:14 — Both sides lose. The landlord lacks a reliable signal. The tenant hands over the money and then has very little leverage if it is withheld. Going to court across a language and legal barrier is rarely realistic.'
#4
$s=Add-Base $p 4;Add-Label $s 'The solution';Add-Title $s 'One deposit. Two protections. A record that travels.' 57 30
$items=@(@(52,'01','LOCK','Deposit enters a smart-contract escrow'),@(353,'02','SETTLE','Returned, split, or resolved by an arbiter'),@(654,'03','PROVE','Outcome becomes a portable rent passport'))
foreach($it in $items){$fill=if($it[1]-eq'02'){$COL.cream}else{$COL.card};Add-Rect $s $it[0] 164 253 238 $fill $COL.border $true|Out-Null;Add-Text $s $it[1] ($it[0]+19) 185 40 15 9 $COL.orangeInk $true|Out-Null;Add-Text $s $it[2] ($it[0]+19) 228 195 25 20 $COL.ink $true|Out-Null;Add-Text $s $it[3] ($it[0]+19) 284 205 61 14 $COL.muted|Out-Null}
Add-Line $s 310 282 342 282 $COL.orange 2 $true|Out-Null;Add-Line $s 611 282 643 282 $COL.orange 2 $true|Out-Null
Add-Text $s 'No custody by us. No editable PDF. No private banking documents.' 80 443 800 30 18 $COL.ink $true 2|Out-Null
Add-Notes $s '1:14–1:46 — Proof of Rent puts only the security deposit into escrow. When the lease ends, the money is returned, split by agreement, or resolved by an arbiter. That verified outcome becomes a portable rent passport.'
#5
$s=Add-Base $p 5;Add-Label $s 'The trust passport';Add-Title $s 'A universal signal — without exposing private documents.' 57 29
Add-Rect $s 48 145 514 287 $COL.card $COL.border $true|Out-Null;Add-Text $s 'TENANT PASSPORT' 76 171 170 16 9 $COL.muted $true|Out-Null;Add-Text $s 'Verified renter' 76 202 250 32 22 $COL.ink $true|Out-Null;Add-Text $s 'Publicly verifiable on Solana' 76 239 260 18 11 $COL.muted|Out-Null
$seal=$s.Shapes.AddShape($ppShapeOval,454,189,62,62);$seal.Fill.ForeColor.RGB=$COL.orange;$seal.Line.Visible=$msoFalse;Add-Text $s 'OK' 466 211 38 14 9 $COL.ink $true 2|Out-Null
$facts=@(@(76,'2 of 2','Deposit back in full'),@(230,'2','Completed leases'),@(384,'18','Months on record'))
foreach($f in $facts){Add-Text $s $f[1] $f[0] 299 130 36 25 $(if($f[1]-eq'2 of 2'){$COL.orangeInk}else{$COL.ink}) $true|Out-Null;Add-Text $s $f[2] $f[0] 345 130 34 10.5 $COL.muted|Out-Null}
Add-Line $s 213 297 213 385 $COL.border .7|Out-Null;Add-Line $s 367 297 367 385 $COL.border .7|Out-Null
$right=@(@(151,'IMMUTABLE','The outcome cannot be rewritten'),@(247,'PORTABLE','Works across landlords and borders'),@(343,'PRIVATE BY DESIGN','Public summary, no bank statement'))
foreach($r in $right){Add-Text $s $r[1] 608 $r[0] 260 17 10 $COL.orangeInk $true|Out-Null;Add-Text $s $r[2] 608 ($r[0]+27) 276 36 14 $COL.ink|Out-Null;if($r[0]-lt343){Add-Line $s 608 ($r[0]+74) 880 ($r[0]+74) $COL.border .7|Out-Null}}
Add-Notes $s '1:46–2:15 — The passport does not publish salary, rent or exact deposit amounts. It shows the signal a landlord actually needs: completed leases, payment history, and whether deposits were returned. The record cannot be silently edited and can be verified without our API.'
#6
$s=Add-Base $p 6;Add-Label $s 'Why blockchain';Add-Title $s 'The blockchain is the neutral third party.' 57 30
$rows=@(@(151,'01','ESCROW','Funds follow contract rules — not platform discretion.'),@(235,'02','EVIDENCE','Lease outcomes are independently verifiable.'),@(319,'03','CONTINUITY','The passport survives any company or database.'))
foreach($r in $rows){Add-Text $s $r[1] 52 $r[0] 32 18 9 $COL.orangeInk $true|Out-Null;Add-Text $s $r[2] 98 $r[0] 135 22 14 $COL.ink $true|Out-Null;Add-Text $s $r[3] 230 $r[0] 360 36 13.5 $COL.muted|Out-Null;Add-Line $s 52 ($r[0]+54) 590 ($r[0]+54) $COL.border .7|Out-Null}
Add-Rect $s 633 136 278 282 $COL.dark $COL.dark $true|Out-Null;Add-Text $s 'LIVE MVP' 658 160 150 17 9 $COL.orange $true|Out-Null;Add-Text $s 'Anchor + Solana' 658 201 220 30 21 $COL.white $true|Out-Null;Add-Text $s "• smart-contract deposit escrow`n• tenant + landlord flow`n• settlement / dispute path`n• public rent passport" 658 255 216 110 13 (RGB 'D5D5CF')|Out-Null;Add-Pill $s 'DEVNET' 659 374 78 (RGB '242421') $COL.white
Add-Text $s "Bank statements prove payments.`nProof of Rent proves how the lease ended." 85 443 790 45 19 $COL.ink $true 2|Out-Null
Add-Notes $s '2:15–2:42 — Blockchain is not decoration here. It removes us as custodian, makes the outcome independently verifiable, and keeps the passport alive even if our company disappears. Our MVP runs on Solana devnet with an Anchor escrow, settlement and dispute flow.'
#7
$s=Add-Base $p 7;Add-Label $s 'The outcome';Add-Text $s "Stop asking renters`nto start from zero." 45 87 590 100 37 $COL.ink $true|Out-Null;Add-Text $s "Protect the deposit today.`nBuild trust for the next lease." 47 230 450 70 23 $COL.orangeInk $true|Out-Null
Add-Rect $s 622 158 244 164 $COL.card $COL.border $true|Out-Null;Add-Text $s 'YOUR RENT HISTORY.' 646 189 190 17 10 $COL.muted $true|Out-Null;Add-Text $s 'Your proof.' 646 224 170 36 27 $COL.ink $true|Out-Null;Add-Line $s 646 282 816 282 $COL.orange 2|Out-Null
Add-Text $s 'Proof of Rent' 47 378 220 29 22 $COL.ink $true|Out-Null;Add-Text $s 'Built for renters in Poland.' 48 414 240 20 13 $COL.muted|Out-Null;Add-Pill $s 'DEMO' 794 402 72 $COL.orange $COL.ink
Add-Notes $s '2:42–3:00 — We stop asking foreign renters to start from zero every time they cross a border or change a flat. Proof of Rent protects the deposit today — and turns it into trust for the next lease. Your rent history. Your proof. [Open the live demo.]'

$p.SaveAs($Out,$ppSaveAsOpenXMLPresentation)
New-Item -ItemType Directory -Force -Path $RenderDir|Out-Null
$p.Export($RenderDir,'PNG',1600,900)
Write-Output "SAVED $Out"
Write-Output "EXPORTED $($p.Slides.Count) slides to $RenderDir"
}
finally { $p.Close();$app.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($p)|Out-Null;[Runtime.InteropServices.Marshal]::ReleaseComObject($app)|Out-Null }
