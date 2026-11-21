"use strict";

const vocabularies = {
  standard: `river orbit gentle velvet stone corner shadow hollow glass garden copper vivid meadow stroke pause narrow olive trace quiet cloud minute pencil tower silver kettle shell paper water spring thread craft wood anchor woven brave lemon loop winter ocean bridge reach listen cover trail repeat travel bright drink signal basket apple breeze giant margin forest attic empty public hidden smile wing frame mirror crown cotton flame globe peach iron whale sleep think drift bench object letter door skill stripe steam harbor yellow rain tablet voice gather bold puzzle lamp cable plate noise stand shift shake palm ferry music amber plain walk border green air tilt field grow paint stream stem fixed wind castle violet reason stand long grass engine proof valley torch circle south north logic soft canvas learn honest grain branch fold spark bread angle stone planet rocket timber place ceiling latch clean fabric handle mountain ribbon pearl planet flame shape pocket bright ladder evening crystal ridge plume reach basket coral draw heavy candle slate music sweet eagle leap note ivory path grid frosty brew simple wheel stable beam craft help desk ring quiet juniper animal story lunch satin fable oak solar wire cause seven taste magic brace spoke moss door generous entry engine atom`,
  hard: `sesquipedalian tergiversation perspicacious quincuncial anfractuous autochthonous eleemosynary magniloquent pusillanimous circumlocution synecdoche synecdochic ineluctable obfuscatory perspicacity obsequiousness equanimous peregrination palimpsestic recalcitrance indefatigable antediluvian epiphenomenon solipsistic heterogeneity monochromatism thaumaturgic concatenation idiosyncrasy juxtaposition incongruous supererogatory verisimilitude prognostication ecclesiastical interstitial vicissitude ineffability intransigent disquisition contumacious loquaciousness concomitance equilibrating mellifluousness surreptitious lachrymatory synchronicity lexicography ichthyological labyrinthine asymmetrical anthropocentric extemporaneous inconsequential epistemological onomatopoeia pleonastic obsolescence circumspection antinomianism bibliomancy circumambient heterochromia sclerophyllous recrudescence abecedarian persiflage irrefragable opprobrious apocryphally convalescence connoisseurship sphygmomanometer luminescence somnambulist antidromous effervescence excrescence inchoateness quintessential magnanimity transubstantiation scintillating nomenclature scintillometer monochromatic amphibology epistemically biodistribution anachronistic conciliatory unequivocally apothecaries phosphorescence irreducibility incommensurable juxtaposing commensurability`,
  code: `await yield array tuple struct lambda static extern const async export import switch enum vector pointer mutable buffer iterator recurse compile encode decode serialize tokenize parse query index bytecode runtime promise resolve reject kernel socket thread mutex atomic semaphore dispatch cache stack heap shard bucket filter reduce collect stream interface generic overload closure operand operator syntax module packet binary scalar offset stride matrix tensor queue dequeue enqueue allocator coroutine middleware dependency pipeline namespace alias descriptor decorator snapshot timestamp filepath checksum payload listener callback fallback invariant metadata parameter argument sandbox channel integer boolean string literal object float bigint cursor parser token registry factory singleton adapter visitor proxy handler context record route config schema format expression statement template reference branch commit merge fetch push clone diff trace debug assert fixture build lint syntax predicate prototype transaction scheduler dispatcher protocol endian version double private public virtual interrupt threadpool rollback frontend backend`
};
for (const key of Object.keys(vocabularies)) {
  vocabularies[key] = [...new Set(vocabularies[key].trim().split(/\s+/))];
}
const targets = {time:[15,30,60,90,120], words:[10,25,50,100], chars:[100,250,500,1000]};
const defaults = {time:30,words:25,chars:250};
const profileNames = {standard:"Everyday",hard:"Hard words",code:"Code terms",raw:"Random letters"};
const profileNotes = {standard:"Familiar words drawn in fresh order.",hard:"Long, uncommon words. Every word has at least ten letters.",code:"Programming terms, language keywords and systems vocabulary.",raw:"Independent random letters in groups. Familiar spelling patterns occur only by chance."};
function shuffle(items) {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}
  return copy;
}
function randomLetters(n) {
  return Array.from({length:n},()=>String.fromCharCode(97+Math.floor(Math.random()*26))).join("");
}
function createGenerator(settings) {
  const raw=settings.profile==="raw";
  const vocabulary=vocabularies[settings.profile] || [];
  let pool=[],last="",ordinal=0;
  const markWord=(word,mark)=>{
    if(settings.caps && ordinal%3===0)word=word[0].toUpperCase()+word.slice(1);
    if(mark)word+=",.;!?:".charAt(Math.floor(Math.random()*6));
    ordinal++;return word;
  };
  function next(){
    if(raw)return randomLetters(4+Math.floor(Math.random()*6));
    if(!pool.length){pool=shuffle(vocabulary);if(pool.at(-1)===last)pool.reverse()}
    last=pool.pop();return last;
  }
  function words(n){
    return Array.from({length:n},(_,i)=>markWord(next(),settings.punctuation && (i===n-1 || Math.random()<0.28))).join(" ");
  }
  // Exact character targets use whole tokens, including their separators and marks.
  function characters(n){
    const lengths=raw?[4,5,6,7,8,9]:[...new Set(vocabulary.map(w=>w.length))];
    const possible=Array(n+1).fill(false);possible[0]=true;
    function fits(remaining,len){return len===remaining || (remaining>len+1 && possible[remaining-len-1])}
    for(let i=1;i<=n;i++)possible[i]=lengths.some(len=>fits(i,len)||(settings.punctuation && fits(i,len+1)));
    const result=[],used=new Set();let remaining=n;
    while(remaining){
      const mark=settings.punctuation && (result.length===0 || Math.random()<0.28);
      const candidates=raw?lengths:vocabulary;
      const lengthOf=w=>raw?w:w.length;
      let append=mark,options=candidates.filter(w=>fits(remaining,lengthOf(w)+Number(append)));
      if(!options.length){append=settings.punctuation && !append;options=candidates.filter(w=>fits(remaining,lengthOf(w)+Number(append)))}
      if(!options.length)throw Error("Unsupported character target");
      const fresh=options.filter(w=>!used.has(w)),deck=fresh.length?fresh:options;
      const choice=deck[Math.floor(Math.random()*deck.length)];
      used.add(choice);const word=markWord(raw?randomLetters(choice):choice,append);
      result.push(word);remaining-=word.length;if(remaining)remaining--;
    }
    return result.join(" ");
  }
  return {words,characters};
}
