import { Prisma } from "@prisma/client";

const models = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));
const reads = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany", "upsert"]);

// Every application query passes this boundary. Composite foreign keys additionally
// enforce ownership for related records, including include/select traversals.
export function scopeQuery(model: string, operation: string, args: any, workspaceId: string) {
  if (model === "AdminUser" || model === "Workspace") return args;
  if (!models.get(model)?.fields.some(f => f.name === "workspaceId")) throw new Error(`Unscoped model: ${model}`);
  const scoped = { ...args };
  if (reads.has(operation)) scoped.where = { ...scoped.where, workspaceId };
  if (["create", "createMany"].includes(operation)) scoped.data = stamp(model, scoped.data, workspaceId, true);
  else if (["update", "updateMany"].includes(operation)) scoped.data = stamp(model, scoped.data, workspaceId, false);
  else if (operation === "upsert") {
    scoped.create = stamp(model, scoped.create, workspaceId, true);
    scoped.update = stamp(model, scoped.update, workspaceId, false);
  } else if (!reads.has(operation)) throw new Error(`Unsupported workspace operation: ${operation}`);
  return scoped;
}
function stamp(model: string, data: any, workspaceId: string, creating: boolean): any {
  if (Array.isArray(data)) return data.map(row => stamp(model, row, workspaceId, creating));
  const result = { ...data };
  if ("workspace" in result || ("workspaceId" in result && result.workspaceId !== workspaceId)) throw new Error("Cannot change record workspace");
  for (const field of models.get(model)!.fields.filter(f => f.kind === "object")) {
    if (field.name in result) throw new Error("Use explicit scoped queries for relation writes");
  }
  if (creating) result.workspaceId = workspaceId;
  else delete result.workspaceId;
  return result;
}
