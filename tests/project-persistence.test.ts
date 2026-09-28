import { describe, expect, it } from "vitest";
import { createProjectSnapshot, parseProject, serializeProject } from "../src/engine/project-persistence.js";
describe("project persistence",()=>{
  it("round-trips the complete current domain snapshot",()=>{
    const snapshot=createProjectSnapshot({compositions:[],decks:[],groups:[],layers:[],slices:[],scenes:[],sources:[],outputs:[]});
    expect(parseProject(serializeProject(snapshot))).toEqual(snapshot);
  });
});
