"use strict";
const workspaces = [
  {id:"field",name:"Field Desk",brief:"A silver instrument panel with an orange timing ruler.",source:"OP–1 field",url:"https://teenage.engineering/products/op-1"},
  {id:"folio",name:"Reading Room",brief:"A narrow writing column, soft paper and a blue caret.",source:"iA Writer",url:"https://ia.net/writer"},
  {id:"dial",name:"Night Dial",brief:"A charcoal room with a round clock beside the passage.",source:"Braun BC22",url:"https://de.braun-clocks.com/de/products/bc22-braun-classic-analogue-alarm-clock-black"},
  {id:"ribbon",name:"Red Ribbon",brief:"Typewriter text on a white sheet above a red carriage.",source:"Olivetti Valentine",url:"https://www.moma.org/collection/works/4576"},
  {id:"pocket",name:"Pocket",brief:"A small, high-contrast screen inside a yellow frame.",source:"Playdate",url:"https://pd.panic.com/"}
];
const query = new URLSearchParams(location.search);
function savedWorkspace(){try{return localStorage.getItem("typelabz.workspace")}catch{return null}}
const requested = query.get("design") || savedWorkspace();
const activeWorkspace = workspaces.find(item => item.id === requested) || workspaces[0];
document.documentElement.dataset.design = activeWorkspace.id;
function keepWorkspace(design){
  try{localStorage.setItem("typelabz.workspace",design.id);location.assign("./")}
  catch{location.assign("./?design="+design.id)}
}
if(query.has("design"))document.addEventListener("DOMContentLoaded",()=>{
  const header=document.querySelector(".header-inner");
  if(!header)return;
  const keep=document.createElement("button");
  keep.id="keep-design";keep.textContent="Choose "+activeWorkspace.name;
  keep.onclick=()=>keepWorkspace(activeWorkspace);header.append(keep);
});
