import { describe, expect, it } from "vitest";
import { ProgramEngine } from "../src/engine/program-engine.js";
import type { Deck } from "../src/domain/deck.js";
import type { Layer } from "../src/domain/layer.js";

const layer=(id:string,order:number):Layer=>({id,name:id,order,transform:{x:0,y:0,scaleX:100,scaleY:100,rotation:0,opacity:100}});
const deck:Deck={id:"d",name:"Deck",layers:[layer("a",1),layer("b",2)],transition:{type:"cut",durationMs:0}};
describe("ProgramEngine snapshot",()=>{
  it("keeps selected layer plus complete immutable layer snapshot",()=>{
    const engine=new ProgramEngine();
    const state=engine.program(deck,"b");
    expect(state.layer?.id).toBe("b");
    expect(state.layers.map(x=>x.id)).toEqual(["a","b"]);
    expect(state.layers).not.toBe(deck.layers);
  });
});
