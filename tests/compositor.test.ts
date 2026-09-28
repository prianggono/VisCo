import { describe, expect, it } from "vitest";
import { compositeProgram } from "../src/engine/compositor.js";
import type { ProgramState } from "../src/engine/program-engine.js";
import type { Layer } from "../src/domain/layer.js";

const layer=(id:string, order:number):Layer=>({id,name:id,order,transform:{x:0,y:0,scaleX:100,scaleY:100,rotation:0,opacity:100}});
describe("multi-layer compositor",()=>{
  it("retains deterministic layer order and render metadata",()=>{
    const state:ProgramState={compositionId:"c",source:{deckId:"d",layerId:"b"},layer:layer("b",2),layers:[layer("b",2),layer("a",1)],transition:null};
    expect(compositeProgram(state).map(x=>x.layerId)).toEqual(["a","b"]);
    expect(compositeProgram(state).map(x=>x.renderOrder)).toEqual([1,2]);
  });
});
