import { describe, expect, it } from "vitest";
import { validateTriggerAction } from "../src/engine/trigger-validator.js";
import type { Deck } from "../src/domain/deck.js";
import type { Layer } from "../src/domain/layer.js";
import type { TriggerAction } from "../src/engine/trigger-engine.js";
const layer=(id:string):Layer=>({id,name:id,transform:{x:0,y:0,scaleX:100,scaleY:100,rotation:0,opacity:100}});
const deck:Deck={id:"d",name:"D",layers:[layer("l")],transition:{type:"cut",durationMs:0}};
describe("Trigger validation",()=>{
  it("allows copied duplicate commands",()=>{
    const action:TriggerAction={type:"sequence",actions:[{type:"program",target:{deckId:"d",layerId:"l"}},{type:"program",target:{deckId:"d",layerId:"l"}}]};
    const result=validateTriggerAction(action,{decks:new Map([["d",deck]]),controller:null as never});
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
