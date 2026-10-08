import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
const s = defineSchema({items:defineTable({name:v.string()})});
const text:string=s.export();
// @ts-expect-error return type remains string
const wrong:number=s.export();
// @ts-expect-error table names remain strict
s.id("missing");
// @ts-expect-error augmentation has no arbitrary methods
s.fakeMethod();
s.id("items");
