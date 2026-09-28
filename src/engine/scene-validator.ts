import type { Scene } from "../domain/scene.js";
export interface SceneValidationResult { readonly valid:boolean; readonly errors:readonly string[]; }
export function validateScene(scene: Scene): SceneValidationResult {
  const errors:string[]=[];
  if(!scene.id.trim()) errors.push("Scene id is required.");
  if(!scene.name.trim()) errors.push("Scene name is required.");
  if(!scene.compositionId.trim()) errors.push(`Scene "${scene.id}" requires a composition.`);
  if(scene.target.kind==="display" && !scene.target.displayId.trim()) errors.push(`Scene "${scene.id}" requires a display target.`);
  if(scene.target.kind==="production" && !(scene.target.record||scene.target.stream||scene.target.virtual)) errors.push(`Production Scene "${scene.id}" must enable at least one production output.`);
  return {valid:errors.length===0,errors};
}
